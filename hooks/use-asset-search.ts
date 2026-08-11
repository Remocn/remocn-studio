"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { filterAssets } from "@/lib/studio/pane-view";
import type { Asset } from "@/shared/library";

export interface AssetSearch {
  found: readonly Asset[];
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  query: string;
}

export function useAssetSearch(assets: readonly Asset[]): AssetSearch {
  const [query, setQuery] = useState("");

  const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  }, []);

  const found = useMemo(() => filterAssets(assets, query), [assets, query]);

  return useMemo(
    () => ({ found, onQueryChange, query }),
    [found, onQueryChange, query]
  );
}
