"use client";

import { Effect, Fiber } from "effect";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { mediaOf } from "@/lib/studio/attachments";
import { type DropPoint, isInside, refusalOf } from "@/lib/studio/drop";
import type { PaneView } from "@/lib/studio/pane-view";
import { watchFileDrops } from "@/lib/studio/shell";
import type { PromptMedia } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

export interface AssetDrop {
  isOver: boolean;
  ref: RefObject<HTMLDivElement | null>;
}

export interface AssetDropSettings {
  paneView: PaneView;
  save: (item: PromptMedia) => Promise<Asset | null>;
  showPane: (view: PaneView) => void;
}

// A drag holding any media over the left pane switches it to Assets while the
// hold lasts, so the drop target is on screen before the drop; letting go
// anywhere else puts the previous view back. A drag of nothing but code never
// moves the view — the refusal is a toast, because the Assets pane it used to
// be an inline line on may not be on screen at all.
export function useAssetDrop({
  paneView,
  save,
  showPane,
}: AssetDropSettings): AssetDrop {
  const [isOver, setIsOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const held = useRef({ paneView, save, showPane });
  held.current = { paneView, save, showPane };
  const cameFrom = useRef<PaneView | null>(null);
  const dragged = useRef(false);
  const holdsMedia = useRef(false);

  const covers = useCallback(
    (point: DropPoint | null) =>
      isInside(
        ref.current?.getBoundingClientRect() ?? null,
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

              if (!covers(position)) {
                revert();
                return;
              }

              const { kept, skipped } = sortedByKind(paths);
              const refusal = refusalOf(skipped);
              if (refusal !== null) {
                toast.add({ title: refusal });
              }

              if (kept.length === 0) {
                revert();
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
              const over = covers(position);
              setIsOver(over);

              if (
                over &&
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
  }, [covers]);

  return useMemo(() => ({ isOver, ref }), [isOver]);
}

function sortedByKind(paths: readonly string[]): {
  kept: PromptMedia[];
  skipped: string[];
} {
  const kept: PromptMedia[] = [];
  const skipped: string[] = [];

  for (const path of paths) {
    const found = mediaOf(path);
    if (found === null) {
      skipped.push(path);
      continue;
    }
    kept.push(found);
  }

  return { kept, skipped };
}
