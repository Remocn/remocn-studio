"use client";

import { Effect, Fiber } from "effect";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { mediaOf } from "@/lib/studio/attachments";
import {
  type DropPoint,
  mediaDrop,
  refusalOf,
  zoneAt,
} from "@/lib/studio/drop";
import type { PaneView } from "@/lib/studio/pane-view";
import { watchFileDrops } from "@/lib/studio/shell";
import type { PromptMedia } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

type ZoneName = "composer" | "library";

export interface DropTarget {
  isOver: boolean;
  ref: RefObject<HTMLDivElement | null>;
}

export interface FileDrops {
  composer: DropTarget;
  library: DropTarget;
}

export interface FileDropSettings {
  drop: (paths: readonly string[]) => void;
  isComposerOpen: boolean;
  paneView: PaneView;
  save: (item: PromptMedia) => Promise<Asset | null>;
  showPane: (view: PaneView) => void;
}

// One watcher, two zones, routed by the point the drop landed on. A drag
// holding any media over the left pane switches it to Assets while the hold
// lasts, so the drop target is on screen before the drop; letting go anywhere
// else puts the previous view back. A drag of nothing but code never moves the
// view — the refusal is a toast, because the pane it used to be an inline line
// on may not be on screen at all.
export function useFileDrops({
  drop,
  isComposerOpen,
  paneView,
  save,
  showPane,
}: FileDropSettings): FileDrops {
  const [over, setOver] = useState<ZoneName | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const held = useRef({ drop, isComposerOpen, paneView, save, showPane });
  held.current = { drop, isComposerOpen, paneView, save, showPane };
  const cameFrom = useRef<PaneView | null>(null);
  const dragged = useRef(false);
  const holdsMedia = useRef(false);

  const zoneUnder = useCallback(
    (point: DropPoint | null) =>
      zoneAt<ZoneName>(
        [
          {
            box: held.current.isComposerOpen
              ? (composerRef.current?.getBoundingClientRect() ?? null)
              : null,
            name: "composer",
          },
          {
            box: libraryRef.current?.getBoundingClientRect() ?? null,
            name: "library",
          },
        ],
        point,
        window.devicePixelRatio
      ),
    []
  );

  useEffect(() => {
    const revert = () => {
      const previous = cameFrom.current;
      cameFrom.current = null;
      if (previous !== null) {
        held.current.showPane(previous);
      }
    };

    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchFileDrops({
            onDrop: ({ paths, position }) => {
              dragged.current = false;
              holdsMedia.current = false;

              const zone = zoneUnder(position);
              if (zone === null) {
                revert();
                return;
              }

              const { kept, skipped } = mediaDrop(paths);
              const refusal = refusalOf(
                skipped,
                zone === "composer" ? "the message" : "the library"
              );
              if (refusal !== null) {
                toast.add({ title: refusal });
              }

              if (kept.length === 0) {
                revert();
                return;
              }

              if (zone === "composer") {
                revert();
                held.current.drop(kept.map((item) => item.path));
                return;
              }

              cameFrom.current = null;
              Effect.runFork(
                Effect.forEach(kept, (item) =>
                  Effect.ignore(Effect.promise(() => held.current.save(item)))
                )
              );
            },
            onEnter: ({ paths }) => {
              dragged.current = true;
              holdsMedia.current = paths.some((path) => mediaOf(path) !== null);
            },
            onOver: (position) => {
              const zone = zoneUnder(position);
              setOver(zone);

              if (
                zone === "library" &&
                holdsMedia.current &&
                cameFrom.current === null &&
                held.current.paneView !== "assets"
              ) {
                cameFrom.current = held.current.paneView;
                held.current.showPane("assets");
              }

              if (position === null && dragged.current) {
                dragged.current = false;
                holdsMedia.current = false;
                revert();
              }
            },
          });
          yield* Effect.never;
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [zoneUnder]);

  return useMemo(
    () => ({
      composer: { isOver: over === "composer", ref: composerRef },
      library: { isOver: over === "library", ref: libraryRef },
    }),
    [over]
  );
}
