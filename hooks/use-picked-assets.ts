"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type Asset, type PromptAsset, promptAssetOf } from "@/shared/library";

export interface PickedAssets {
  add: (asset: Asset) => number;
  clear: () => void;
  items: PromptAsset[];
  removeAt: (index: number) => void;
}

export function usePickedAssets(): PickedAssets {
  const [items, setItems] = useState<PromptAsset[]>([]);
  const held = useRef<PromptAsset[]>([]);

  const commit = useCallback((next: PromptAsset[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const add = useCallback(
    (asset: Asset) => {
      const known = held.current.findIndex((item) => item.slug === asset.slug);
      if (known !== -1) {
        return known;
      }

      const at = held.current.length;
      commit([...held.current, promptAssetOf(asset)]);
      return at;
    },
    [commit]
  );

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  return useMemo(
    () => ({ add, clear, items, removeAt }),
    [add, clear, items, removeAt]
  );
}
