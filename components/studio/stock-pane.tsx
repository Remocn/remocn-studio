"use client";

import type { MouseEvent } from "react";
import { CheckIcon, SearchIcon } from "@/components/icons";
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
import { Spinner } from "@/components/ui/spinner";
import { type Stock, stockKeyOf, useStock } from "@/hooks/use-stock";
import { clipTime } from "@/lib/studio/time";
import type { StockProgress } from "@/shared/ipc";
import type { StockItem, StockKind } from "@/shared/library";
import { PaneScreen } from "./pane-screen";

const PLACEHOLDERS = ["one", "two", "three"];

export function StockPane({
  kind,
  onSaved,
}: {
  kind: StockKind;
  onSaved: () => void;
}) {
  const stock = useStock(kind, onSaved);

  return (
    <PaneScreen
      pinned={
        <div className="px-1">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon
                aria-hidden="true"
                className="size-4 text-muted-foreground opacity-100"
              />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search Pexels"
              onChange={stock.onQueryChange}
              placeholder={
                kind === "photo" ? "Search photos…" : "Search videos…"
              }
              type="search"
              value={stock.query}
            />
          </InputGroup>
        </div>
      }
    >
      <StockBody stock={stock} />
    </PaneScreen>
  );
}

function StockBody({ stock }: { stock: Stock }) {
  if (stock.isConfigured === false) {
    return (
      <Empty className="border-none px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-base">
            Stock search is unavailable
          </EmptyTitle>
          <EmptyDescription className="text-pretty">
            This build has no Pexels key configured. Setting
            REMOCN_STUDIO_PEXELS_KEY supplies one.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (stock.error !== null) {
    return (
      <p className="break-words px-2 py-4 text-destructive text-sm">
        {stock.error}
      </p>
    );
  }

  if (stock.query.trim().length === 0) {
    return (
      <Empty className="border-none px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-base">Search the stock</EmptyTitle>
          <EmptyDescription className="text-pretty">
            Pexels photos and clips land in the library with their license and
            author remembered, ready to drop into any video.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (stock.isSearching && stock.items.length === 0) {
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

  if (stock.items.length === 0) {
    return (
      <p className="break-words px-2 py-4 text-muted-foreground text-sm">
        Nothing on Pexels matches “{stock.query.trim()}”.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-1 pb-2">
      <div className="grid grid-cols-2 items-start gap-2">
        {stock.items.map((item) => {
          const key = stockKeyOf(item);
          return (
            <StockCard
              isSaved={stock.saved.has(key)}
              isSaving={stock.saving.has(key)}
              item={item}
              key={key}
              onSave={stock.onSave}
              progress={stock.progress.get(key) ?? null}
            />
          );
        })}
      </div>

      {stock.hasMore ? (
        <Button onClick={stock.more} size="sm" variant="outline">
          More results
        </Button>
      ) : null}
    </div>
  );
}

// The thumbnail streams straight from the Pexels CDN; nothing is downloaded
// until the card is clicked.
function StockCard({
  isSaved,
  isSaving,
  item,
  onSave,
  progress,
}: {
  isSaved: boolean;
  isSaving: boolean;
  item: StockItem;
  onSave: (event: MouseEvent<HTMLButtonElement>) => void;
  progress: StockProgress | null;
}) {
  const length = item.duration === null ? null : clipTime(item.duration);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-label={
          isSaved ? `${item.name} is in the library` : `Save ${item.name}`
        }
        className="group relative overflow-hidden rounded-md outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-default"
        disabled={isSaving || isSaved}
        onClick={onSave}
        title={item.name}
        type="button"
        value={stockKeyOf(item)}
      >
        {/* biome-ignore lint/performance/noImgElement: a Pexels CDN thumbnail, which next/image cannot serve from a static export */}
        {/* biome-ignore lint/correctness/useImageSize: the card fixes the box and the picture is cropped into it */}
        <img
          alt={item.name}
          className="h-24 w-full object-cover"
          loading="lazy"
          src={item.thumbnail}
        />

        {length === null ? null : (
          <span className="absolute right-1 bottom-1 rounded-sm bg-black/60 px-1 font-mono text-2xs text-white tabular-nums">
            {length}
          </span>
        )}

        {isSaving ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner className="size-4 text-white" />
            <DownloadBar progress={progress} />
          </span>
        ) : null}

        {isSaved ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <CheckIcon aria-hidden className="size-5 text-white" />
          </span>
        ) : null}
      </button>

      <p className="truncate text-muted-foreground text-xs">{item.author}</p>
    </div>
  );
}

function DownloadBar({ progress }: { progress: StockProgress | null }) {
  if (progress === null || progress.total === null || progress.total === 0) {
    return null;
  }

  const share = Math.min(1, progress.received / progress.total);

  return (
    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
      <span
        className="block h-full bg-white"
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </span>
  );
}
