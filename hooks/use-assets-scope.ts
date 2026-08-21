"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { StockKind } from "@/shared/library";

export const ASSET_SCOPES = ["library", "photo", "video"] as const;

export type AssetScope = (typeof ASSET_SCOPES)[number];

export function isAssetScope(value: string): value is AssetScope {
  return (ASSET_SCOPES as readonly string[]).includes(value);
}

export function stockKindOf(scope: AssetScope): StockKind | null {
  return scope === "library" ? null : scope;
}

export interface AssetsScope {
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  scope: AssetScope;
}

export function useAssetsScope(): AssetsScope {
  const [scope, setScope] = useState<AssetScope>("library");

  const onPick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const picked = event.currentTarget.value;
    if (isAssetScope(picked)) {
      setScope(picked);
    }
  }, []);

  return useMemo(() => ({ onPick, scope }), [onPick, scope]);
}
