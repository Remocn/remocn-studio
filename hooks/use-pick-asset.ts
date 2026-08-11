"use client";

import type { MouseEvent } from "react";
import { useCallback, useRef } from "react";
import type { Asset } from "@/shared/library";

export function usePickAsset(
  assets: readonly Asset[],
  pick: (asset: Asset) => void
): (event: MouseEvent<HTMLButtonElement>) => void {
  const held = useRef(assets);
  held.current = assets;

  return useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const slug = event.currentTarget.value;
      const asset = held.current.find((item) => item.slug === slug);

      if (asset !== undefined) {
        pick(asset);
      }
    },
    [pick]
  );
}
