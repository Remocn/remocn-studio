"use client";

import { CheckIcon, SearchIcon } from "lucide-react";
import type { MouseEvent } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { type Stock, stockKeyOf, useStock } from "@/hooks/use-stock";
import { clipTime } from "@/lib/studio/time";
import type { StockProgress } from "@/shared/ipc";
import type { StockItem, StockKind } from "@/shared/library";

const PLACEHOLDERS = ["one", "two", "three"];

export function StockPane({
  kind,
  onOpenSettings,
  onSaved,
}: {
  kind: StockKind;
  onOpenSettings: () => void;
  onSaved: () => void;
}) {
  const stock = useStock(kind, onSaved);

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 bg-sidebar px-1 pb-2">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-muted-foreground" />
        <Input
          aria-label="Search Pexels"
          className="h-9 pl-8"
          onChange={stock.onQueryChange}
          placeholder={kind === "photo" ? "Search photos…" : "Search videos…"}
          type="search"
          value={stock.query}
        />
      </div>

      <StockBody onOpenSettings={onOpenSettings} stock={stock} />
    </div>
  );
}

function StockBody({
  onOpenSettings,
  stock,
}: {
  onOpenSettings: () => void;
  stock: Stock;
}) {
  if (stock.isConfigured === false) {
    return (
      <Empty className="border-none px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-base">Pexels needs an API key</EmptyTitle>
          <EmptyDescription className="text-pretty">
            The key is free — create one at pexels.com/api, then paste it into
            Settings. It stays on this machine.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onOpenSettings} size="sm" variant="outline">
          Open Settings
        </Button>
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
      <div className="grid grid-cols-2 gap-2">
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
        className="group relative overflow-hidden rounded-md outline-none ring-1 ring-foreground/10 ring-inset transition-shadow focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:cursor-default"
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
          <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white tabular-nums">
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
