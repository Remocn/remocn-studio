"use client";

import { SearchIcon } from "lucide-react";
import type { ChangeEvent, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { cn } from "@/lib/utils";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";

const PLACEHOLDERS = ["one", "two", "three"];

export function AssetSearchField({
  onChange,
  value,
}: {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    // Sticky against the pane's scroll container: the list scrolls under it
    // and the field never leaves the top. The background is what stops the
    // cards showing through the padding as they pass.
    <div className="sticky top-0 z-10 bg-sidebar px-1 pb-2">
      <SearchIcon className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-muted-foreground" />
      <Input
        aria-label="Search by name"
        className="h-9 pl-8"
        onChange={onChange}
        placeholder="Search…"
        type="search"
        value={value}
      />
    </div>
  );
}

export function NothingFound({ query }: { query: string }) {
  return (
    <p className="break-words px-2 py-4 text-muted-foreground text-sm">
      Nothing here is called “{query.trim()}”.
    </p>
  );
}

export function AssetsPane({
  assets,
  error,
  isLoading,
  isOver,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  isOver: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  const search = useAssetSearch(assets);

  return (
    <div
      className={cn(
        "relative rounded-lg transition-colors",
        isOver && "bg-primary/5 outline-dashed outline-2 outline-primary/40"
      )}
    >
      {assets.length === 0 ? null : (
        <AssetSearchField
          onChange={search.onQueryChange}
          value={search.query}
        />
      )}

      <AssetsBody
        assets={search.found}
        error={error}
        isEmpty={assets.length === 0}
        isLoading={isLoading}
        onPick={onPick}
        onRemove={onRemove}
        onRetry={onRetry}
        query={search.query}
      />

      {isOver ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-primary text-xs">
          Drop to add to the library
        </p>
      ) : null}
    </div>
  );
}

function AssetsBody({
  assets,
  error,
  isEmpty,
  isLoading,
  onPick,
  onRemove,
  onRetry,
  query,
}: {
  assets: readonly Asset[];
  error: string | null;
  isEmpty: boolean;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  query: string;
}) {
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
          <EmptyTitle className="text-base">Nothing saved yet</EmptyTitle>
          <EmptyDescription className="text-pretty">
            Drag pictures, video or sound here from Finder, or ask Claude to put
            an animation you like into the library. Everything here can be
            dropped into any other video.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (assets.length === 0) {
    return <NothingFound query={query} />;
  }

  return <AssetGrid assets={assets} onPick={onPick} onRemove={onRemove} />;
}
