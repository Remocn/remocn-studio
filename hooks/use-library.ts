"use client";

import { Duration, Effect, Exit, Fiber } from "effect";
import type { MouseEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { causeMessage } from "@/lib/error-message";
import { previewUrl } from "@/lib/studio/attachments";
import { type ClipboardError, saveImages } from "@/lib/studio/clipboard";
import {
  draftFromAttachment,
  listAssets,
  previewAsset,
  proxyAsset,
  removeAsset,
  renameAsset,
  saveAsset,
} from "@/lib/studio/library";
import {
  canEncode,
  heightOf,
  ProxyError,
  proxyFor,
  saveProxy,
  sourceFor,
} from "@/lib/studio/proxy";
import { stillFor, ThumbnailError } from "@/lib/studio/thumbnail";
import type { PromptMedia } from "@/shared/ipc";
import {
  type Asset,
  type AssetType,
  assetTypeFor,
  hasStill,
  needsProxy,
  proxyableFileOf,
  stillFileOf,
} from "@/shared/library";

const UNDO_WINDOW = "10 seconds";

export interface Library {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  reload: () => void;
  rename: (slug: string, name: string) => Promise<void>;
  save: (attachment: PromptMedia) => Promise<Asset | null>;
  undoRemove: (slug: string) => void;
}

interface Held {
  asset: Asset;
  fiber: Fiber.Fiber<void, never>;
  index: number;
  toastId: string;
}

interface Taken {
  duration: number | null;
  path: string;
}

const NOTHING: Taken = { duration: null, path: "" };

// The still is taken here, before the asset exists, so the sidecar has a picture
// to file next to it. It is decoration: media that will not decode still goes
// into the library, wearing its type icon.
function takenStill(
  type: AssetType,
  path: string,
  name: string
): Effect.Effect<Taken, ThumbnailError | ClipboardError> {
  const url = previewUrl(path);

  return url === null
    ? Effect.fail(
        new ThumbnailError({ message: `${name} has no readable path.` })
      )
    : stillFor(type, url, name).pipe(
        Effect.flatMap((still) =>
          saveImages([still.file]).pipe(
            Effect.flatMap((paths) => {
              const [written] = paths;
              return written === undefined
                ? Effect.fail(
                    new ThumbnailError({
                      message: `${name}'s still was not written.`,
                    })
                  )
                : Effect.succeed({ duration: still.duration, path: written });
            })
          )
        )
      );
}

async function thumbnailOf(item: PromptMedia, type: AssetType): Promise<Taken> {
  const taken = await Effect.runPromiseExit(
    takenStill(type, item.path, item.name)
  );

  return Exit.isSuccess(taken) ? taken.value : NOTHING;
}

// A video with no still falls back to a live <video> in the panel, and Base UI
// unmounts a hidden tab — so without this the frame would be decoded again on
// every visit to the tab. Taking it once and filing it turns the second visit
// into an <img>. Failures are remembered for the session: a clip that will not
// decode must not be retried on every switch.
function useBackfilledThumbnails(
  assets: readonly Asset[],
  onPreviewed: (asset: Asset) => void
) {
  const attempted = useRef(new Set<string>());
  const held = useRef(onPreviewed);
  held.current = onPreviewed;

  useEffect(() => {
    const pending = assets.filter(
      (asset) =>
        asset.preview === null &&
        stillFileOf(asset) !== null &&
        !attempted.current.has(asset.slug)
    );

    if (pending.length === 0) {
      return;
    }

    // Sequential on purpose: decoding a library's worth of video at once is
    // the cost this exists to avoid, not a faster way to pay it. Each is
    // marked as its own turn begins, not up front, so a tail cut short by a
    // new listing is picked up again rather than lost.
    const fiber = Effect.runFork(
      Effect.forEach(
        pending,
        (asset) =>
          Effect.sync(() => attempted.current.add(asset.slug)).pipe(
            Effect.andThen(
              takenStill(asset.type, stillFileOf(asset) ?? "", asset.name)
            ),
            Effect.flatMap((taken) =>
              previewAsset(asset.slug, taken.path, taken.duration)
            ),
            Effect.tap((saved) => Effect.sync(() => held.current(saved))),
            Effect.ignore
          ),
        { discard: true }
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [assets]);
}

// Measured: 0.58x realtime even with a hardware encoder, so a two-minute clip is
// three and a half minutes of work. That is the whole reason this is a backfill
// and not a step of saving: the asset is in the library and usable from the
// moment it lands, and until its proxy exists the preview simply streams the
// original — slower to seek, never broken.
//
// It is a *queue* rather than the thumbnails' fiber-per-listing, and the length
// of a conversion is the difference. There, finishing one item changes `assets`,
// which tears the effect down and re-forks it over what is left — the item in
// flight is interrupted, and having been marked already, never retried. At a
// tenth of a second per still that window is invisible; at three minutes it is
// the whole job. So the worker outlives the listing, drains what it is given,
// and picks up anything pushed while it ran.
function useBackfilledProxies(
  assets: readonly Asset[],
  onProxied: (asset: Asset) => void
) {
  const queued = useRef(new Set<string>());
  const waiting = useRef<Asset[]>([]);
  const worker = useRef<Fiber.Fiber<void, never> | null>(null);
  const held = useRef(onProxied);
  held.current = onProxied;

  const drain = useCallback(() => {
    if (worker.current !== null || waiting.current.length === 0) {
      return;
    }

    worker.current = Effect.runFork(
      convertNext(waiting, held).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            worker.current = null;
            drain();
          })
        )
      )
    );
  }, []);

  useEffect(() => {
    for (const asset of assets) {
      if (
        !(asset.proxied || queued.current.has(asset.slug)) &&
        proxyableFileOf(asset) !== null
      ) {
        queued.current.add(asset.slug);
        waiting.current.push(asset);
      }
    }

    drain();
  }, [assets, drain]);

  useEffect(
    () => () => {
      const running = worker.current;
      worker.current = null;
      if (running !== null) {
        Effect.runFork(Fiber.interrupt(running));
      }
    },
    []
  );
}

// Suspended so the queue is read again each time round: an asset saved while the
// worker is mid-conversion joins the same run rather than waiting for a listing.
function convertNext(
  waiting: RefObject<Asset[]>,
  held: RefObject<(asset: Asset) => void>
): Effect.Effect<void> {
  return Effect.suspend(() => {
    const asset = waiting.current.shift();

    if (asset === undefined) {
      return Effect.void;
    }

    return proxied(asset).pipe(
      Effect.tap((saved) => Effect.sync(() => held.current(saved))),
      // A proxy is an optimisation, so a failure must not reach the pane — but
      // swallowing it without a trace leaves a feature that can be silently
      // dead, which is what the first run of this was. The console is where a
      // background job says why it gave up: invisible to whoever is making a
      // video, one line away from whoever is fixing it.
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          console.warn(
            `[proxy] ${asset.name} (${asset.slug}) was left on its original:`,
            causeMessage(cause) ?? cause
          );
        })
      ),
      Effect.ignore,
      Effect.andThen(convertNext(waiting, held))
    );
  });
}

// Deciding costs a metadata read; converting costs minutes. A file already at or
// under the target, and a webview with no encoder, both settle the question for
// good by recording the decision rather than the file.
function proxied(asset: Asset) {
  const file = proxyableFileOf(asset) ?? "";
  const url = previewUrl(file);

  if (url === null) {
    return Effect.fail(
      new ProxyError({ message: `${asset.name} has no path.` })
    );
  }

  return Effect.gen(function* () {
    if (!(yield* canEncode())) {
      return yield* at("recording that this webview cannot encode", () =>
        proxyAsset(asset.slug, null)
      );
    }

    const height = yield* at("reading the source height", () =>
      heightOf(url, asset.name)
    );

    if (!needsProxy(asset.type, height)) {
      return yield* at(`recording that ${height}p needs no proxy`, () =>
        proxyAsset(asset.slug, null)
      );
    }

    const source = yield* at("reading the file", () => sourceFor(url));
    const blob = yield* at("converting", () => proxyFor(source));
    const written = yield* at("writing the proxy", () =>
      saveProxy(asset.slug, blob)
    );

    return yield* at("filing the proxy", () => proxyAsset(asset.slug, written));
  });
}

// Which step gave up, said in the failure itself. A backfill has no screen to
// report on, so the message has to carry the place as well as the reason.
function at<A, E extends { message: string }>(
  stage: string,
  step: () => Effect.Effect<A, E>
): Effect.Effect<A, ProxyError> {
  return step().pipe(
    Effect.catch((failure) =>
      Effect.fail(new ProxyError({ message: `${stage}: ${failure.message}` }))
    )
  );
}

// A component is saved by the agent, through its own MCP tool, so it lands on
// disk with the pane never hearing about it — and used to appear only after a
// relaunch. A turn settling is the moment to look again: it is the only thing
// that can have written to the library behind our back, and the listing is one
// folder scan. Quiet, because a skeleton after every turn would be a flicker
// reporting nothing.
function useReloadWhenTurnsSettle(isRunning: boolean, reload: () => void) {
  const was = useRef(isRunning);
  const held = useRef(reload);
  held.current = reload;

  useEffect(() => {
    const settled = was.current && !isRunning;
    was.current = isRunning;

    if (settled) {
      held.current();
    }
  }, [isRunning]);
}

export function useLibrary(
  isTurnRunning = false,
  undoWindow: Duration.Input = UNDO_WINDOW
): Library {
  const [assets, setAssets] = useState<readonly Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const held = useRef(new Map<string, Held>());

  const load = useCallback((quiet: boolean) => {
    if (!quiet) {
      setIsLoading(true);
    }

    Effect.runFork(
      listAssets.pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            // A pending delete is still on disk, so a listing taken inside its
            // undo window would put the row back and read as the delete having
            // failed.
            setAssets(rows.filter((row) => !held.current.has(row.slug)));
            setError(null);
          })
        ),
        Effect.catch((failure) => Effect.sync(() => setError(failure.message))),
        Effect.ensuring(Effect.sync(() => setIsLoading(false)))
      )
    );
  }, []);

  const reload = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  useReloadWhenTurnsSettle(isTurnRunning, refresh);

  const save = useCallback(async (attachment: PromptMedia) => {
    const type = assetTypeFor([attachment.name]);
    const taken = hasStill(type)
      ? await thumbnailOf(attachment, type)
      : NOTHING;
    const draft = draftFromAttachment(attachment, type, taken);

    const exit = await Effect.runPromiseExit(saveAsset(draft));

    if (Exit.isFailure(exit)) {
      setError(causeMessage(exit.cause));
      return null;
    }

    setAssets((current) => [exit.value, ...current]);
    setError(null);
    return exit.value;
  }, []);

  const replace = useCallback((saved: Asset) => {
    setAssets((current) =>
      current.map((asset) => (asset.slug === saved.slug ? saved : asset))
    );
  }, []);

  useBackfilledThumbnails(assets, replace);
  useBackfilledProxies(assets, replace);

  const rename = useCallback(async (slug: string, name: string) => {
    const exit = await Effect.runPromiseExit(renameAsset(slug, name));

    if (Exit.isFailure(exit)) {
      setError(causeMessage(exit.cause));
      return;
    }

    const saved = exit.value;
    setAssets((current) =>
      current.map((asset) => (asset.slug === slug ? saved : asset))
    );
    setError(null);
  }, []);

  const drop = useCallback((slug: string) => {
    const pending = held.current.get(slug);
    if (pending === undefined) {
      return null;
    }

    held.current.delete(slug);
    Effect.runFork(Fiber.interrupt(pending.fiber));
    toast.close(pending.toastId);
    return pending;
  }, []);

  const undoRemove = useCallback(
    (slug: string) => {
      const pending = drop(slug);
      if (pending === null) {
        return;
      }

      setAssets((current) => {
        if (current.some((row) => row.slug === slug)) {
          return current;
        }
        const next = [...current];
        next.splice(Math.min(pending.index, next.length), 0, pending.asset);
        return next;
      });
    },
    [drop]
  );

  // The row leaves at once and the folder goes only when the window closes, so
  // an undo is a fiber interrupt and the files were never touched. Quitting
  // inside the window drops the delete rather than rushing it: the asset comes
  // back next launch, which is the failure direction that keeps data.
  const onRemove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const slug = event.currentTarget.value;
      const index = assets.findIndex((row) => row.slug === slug);
      const asset = assets[index];
      if (asset === undefined) {
        return;
      }

      setAssets((current) => current.filter((row) => row.slug !== slug));

      const toastId = toast.add({
        actionProps: { children: "Undo", onClick: () => undoRemove(slug) },
        description: asset.name,
        timeout: Duration.toMillis(undoWindow),
        title: "Asset deleted",
      });

      const fiber = Effect.runFork(
        Effect.sleep(undoWindow).pipe(
          Effect.andThen(removeAsset(slug)),
          Effect.catch((failure) =>
            Effect.sync(() => setError(failure.message))
          ),
          Effect.asVoid,
          Effect.ensuring(
            Effect.sync(() => {
              if (held.current.get(slug)?.toastId === toastId) {
                held.current.delete(slug);
                toast.close(toastId);
              }
            })
          )
        )
      );

      held.current.set(slug, { asset, fiber, index, toastId });
    },
    [assets, undoRemove, undoWindow]
  );

  return useMemo(
    () => ({
      assets,
      error,
      isLoading,
      onRemove,
      reload,
      rename,
      save,
      undoRemove,
    }),
    [assets, error, isLoading, onRemove, reload, rename, save, undoRemove]
  );
}
