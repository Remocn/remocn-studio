"use client";

import type { ChangeEvent, MouseEvent } from "react";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { fileManagerName } from "@/lib/studio/platform";
import { cn } from "@/lib/utils";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";
import { FailureText } from "./failure-text";
import { PaneScreen } from "./pane-screen";

const PLACEHOLDERS = ["one", "two", "three"];

// A tile carries its own positioned children — an `absolute inset-0 z-10`
// trigger over the whole card and `z-20` actions — so a heading that stays
// sticky inside the scroller has to sit above both, or a row scrolling under
// it prints straight through the word. The search field is not sticky at all:
// it is pinned above the scroller by `PaneScreen`, because a stuck field took
// no clicks — see the note there.
export const OVER_TILES = "z-30";

export function AssetSearchField({
  onChange,
  value,
}: {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className="px-1">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground opacity-100"
          />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search by name"
          onChange={onChange}
          placeholder="Search…"
          type="search"
          value={value}
        />
      </InputGroup>
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
        "relative flex min-h-0 flex-1 flex-col rounded-lg transition-colors",
        isOver && "bg-primary/5 outline-dashed outline-2 outline-primary/40"
      )}
    >
      <PaneScreen
        pinned={
          assets.length === 0 ? null : (
            <AssetSearchField
              onChange={search.onQueryChange}
              value={search.query}
            />
          )
        }
      >
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
      </PaneScreen>

      {isOver ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-foreground text-xs">
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
          <EmptyTitle className="text-balance">
            The library is unavailable
          </EmptyTitle>
          <EmptyDescription>
            <FailureText
              align="center"
              fallback="Something went wrong while reading the library."
              text={error}
            />
          </EmptyDescription>
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
            Drag pictures, video or sound here from {fileManagerName()}, or ask
            the agent to put an animation you like into the library. Everything
            here can be dropped into any other video.
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
