"use client";

import { type MouseEvent, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { captionAssets } from "@/lib/studio/pane-view";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";
import { AssetSearchField, NothingFound } from "./assets-pane";
import { PaneScreen } from "./pane-screen";

export function CaptionsPane({
  assets,
  error,
  isLoading,
  onRetry,
  onPick,
  unavailable = null,
}: {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  unavailable?: string | null;
}) {
  const captions = useMemo(() => captionAssets(assets), [assets]);
  const search = useAssetSearch(captions);
  return (
    <PaneScreen
      pinned={
        <AssetSearchField
          onChange={search.onQueryChange}
          value={search.query}
        />
      }
    >
      {error ? (
        <div className="grid gap-2 px-1 text-xs">
          <p role="alert">{error}</p>
          <Button onClick={onRetry} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="px-1 text-muted-foreground text-xs" role="status">
          Loading captions…
        </p>
      ) : null}
      {unavailable ? (
        <p className="px-1 pb-3 text-muted-foreground text-xs" role="status">
          {unavailable}
        </p>
      ) : null}
      {error || isLoading ? null : (
        <fieldset
          aria-label="Choose a caption style"
          className="min-w-0 border-0 p-0 disabled:opacity-60"
          disabled={unavailable !== null}
        >
          {captions.length === 0 ? (
            <p className="px-1 text-muted-foreground text-xs">
              Caption styles are unavailable. Try loading the catalogue again.
            </p>
          ) : null}
          {captions.length > 0 && search.found.length === 0 ? (
            <NothingFound query={search.query} />
          ) : null}
          {search.found.length > 0 ? (
            <AssetGrid assets={search.found} onPick={onPick} />
          ) : null}
        </fieldset>
      )}
      {!(error || isLoading) && captions.length === 0 ? (
        <Button onClick={onRetry} size="sm" variant="outline">
          Reload captions
        </Button>
      ) : null}
    </PaneScreen>
  );
}
