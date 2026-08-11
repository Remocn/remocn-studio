"use client";

import { Effect, Fiber } from "effect";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mediaOf } from "@/lib/studio/attachments";
import { type DropPoint, isInside, refusalOf } from "@/lib/studio/drop";
import { watchFileDrops } from "@/lib/studio/shell";
import type { PromptMedia } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

export interface AssetDrop {
  isOver: boolean;
  ref: RefObject<HTMLDivElement | null>;
  rejected: string | null;
}

export interface AssetDropSettings {
  save: (item: PromptMedia) => Promise<Asset | null>;
}

export function useAssetDrop({ save }: AssetDropSettings): AssetDrop {
  const [isOver, setIsOver] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const held = useRef(save);
  held.current = save;

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
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchFileDrops({
            onDrop: ({ paths, position }) => {
              if (!covers(position)) {
                return;
              }

              const { kept, skipped } = sortedByKind(paths);
              setRejected(refusalOf(skipped));

              Effect.runFork(
                Effect.forEach(kept, (item) =>
                  Effect.ignore(Effect.promise(() => held.current(item)))
                )
              );
            },
            onOver: (position) => setIsOver(covers(position)),
          });
          yield* Effect.never;
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [covers]);

  return useMemo(() => ({ isOver, ref, rejected }), [isOver, rejected]);
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
