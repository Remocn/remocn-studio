"use client";

import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { filterAssets } from "@/lib/studio/pane-view";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";
import { AssetSearchField, NothingFound } from "./assets-pane";

const PLACEHOLDERS = ["one", "two", "three"];

// The order the studio ships, which is also the scroll's order.
const CATEGORY_ORDER = [
  "Typography",
  "Transitions",
  "Shaders",
  "Filters",
  "Effects",
];

// Sticky one notch below the search field, so the category a scroll is
// passing through stays named at the top of the list.
function GroupHeading({ label }: { label: string }) {
  return (
    <h3 className="sticky top-11 z-[9] flex h-8 shrink-0 items-center bg-sidebar px-2 font-medium text-sidebar-foreground/70 text-xs">
      {label}
    </h3>
  );
}

// The saved components lead; the bundled remocn set follows, its category
// subheadings doubling as the scroll's landmarks. A heading over an empty
// group is never rendered.
export function ComponentsPane({
  assets,
  bundled,
  error,
  isLoading,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  bundled: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  const search = useAssetSearch(assets);
  const isEmpty = assets.length === 0 && bundled.length === 0;
  const foundBundled = filterAssets(bundled, search.query);

  if (error !== null) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyTitle>The library is unavailable</EmptyTitle>
          <EmptyDescription className="break-words">{error}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </Empty>
    );
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        {PLACEHOLDERS.map((placeholder) => (
          <SidebarMenuItem key={placeholder}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  if (isEmpty) {
    return (
      <Empty className="border-none px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-base">No components yet</EmptyTitle>
          <EmptyDescription className="text-pretty">
            Ask Claude to save an animation or a scene you like, and it will
            land here, ready to drop into any other video.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const categories = CATEGORY_ORDER.map((label) => ({
    label,
    matched: foundBundled.filter((asset) => asset.category === label),
  })).filter((group) => group.matched.length > 0);

  if (search.found.length === 0 && categories.length === 0) {
    return (
      <div>
        <AssetSearchField
          onChange={search.onQueryChange}
          value={search.query}
        />
        <NothingFound query={search.query} />
      </div>
    );
  }

  return (
    <div>
      <AssetSearchField onChange={search.onQueryChange} value={search.query} />

      {search.found.length === 0 ? null : (
        <>
          {bundled.length === 0 ? null : <GroupHeading label="Saved" />}
          <AssetGrid
            assets={search.found}
            onPick={onPick}
            onRemove={onRemove}
          />
        </>
      )}

      {categories.map((group) => (
        <div key={group.label}>
          <GroupHeading label={group.label} />
          <AssetGrid assets={group.matched} onPick={onPick} />
        </div>
      ))}
    </div>
  );
}
