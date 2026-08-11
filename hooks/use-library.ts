"use client";

import { Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { previewUrl } from "@/lib/studio/attachments";
import { type ClipboardError, saveImages } from "@/lib/studio/clipboard";
import {
  draftFromAttachment,
  listAssets,
  previewAsset,
  removeAsset,
  renameAsset,
  saveAsset,
} from "@/lib/studio/library";
import { stillFor, ThumbnailError } from "@/lib/studio/thumbnail";
import type { PromptMedia } from "@/shared/ipc";
import {
  type Asset,
  type AssetType,
  assetTypeFor,
  hasStill,
  stillFileOf,
} from "@/shared/library";

export interface Library {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  reload: () => void;
  remove: (slug: string) => Promise<void>;
  rename: (slug: string, name: string) => Promise<void>;
  save: (attachment: PromptMedia) => Promise<Asset | null>;
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

export function useLibrary(): Library {
  const [assets, setAssets] = useState<readonly Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(() => {
    setIsLoading(true);

    Effect.runFork(
      listAssets.pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            setAssets(rows);
            setError(null);
          })
        ),
        Effect.catch((failure) => Effect.sync(() => setError(failure.message))),
        Effect.ensuring(Effect.sync(() => setIsLoading(false)))
      )
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  const remove = useCallback(async (slug: string) => {
    setAssets((current) => current.filter((asset) => asset.slug !== slug));

    const exit = await Effect.runPromiseExit(removeAsset(slug));
    if (Exit.isFailure(exit)) {
      setError(causeMessage(exit.cause));
    }
  }, []);

  return useMemo(
    () => ({ assets, error, isLoading, reload, remove, rename, save }),
    [assets, error, isLoading, reload, remove, rename, save]
  );
}
