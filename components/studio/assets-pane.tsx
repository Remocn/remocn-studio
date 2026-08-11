"use client";

import { Trash2Icon } from "lucide-react";
import type { MouseEvent } from "react";
import { memo } from "react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
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
import type { AssetDrop } from "@/hooks/use-asset-drop";
import { usePreviewImage } from "@/hooks/use-preview-image";
import { previewUrl } from "@/lib/studio/attachments";
import { clipTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPE_LABELS,
  type Asset,
  playableFileOf,
} from "@/shared/library";
import { AssetTypeIcon } from "./asset-type-icon";
import { VideoThumbnail } from "./video-thumbnail";

const PLACEHOLDERS = ["one", "two", "three"];

export function AssetsPane({
  assets,
  drop,
  error,
  isLoading,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  drop: AssetDrop;
  error: string | null;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg transition-colors",
        drop.isOver &&
          "bg-primary/5 outline-dashed outline-2 outline-primary/40"
      )}
      ref={drop.ref}
    >
      <AssetsBody
        assets={assets}
        error={error}
        isLoading={isLoading}
        onPick={onPick}
        onRemove={onRemove}
        onRetry={onRetry}
      />

      {drop.isOver ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-primary text-xs">
          Drop to add to the library
        </p>
      ) : null}

      {drop.rejected === null ? (
        <p className="min-h-4 px-2 text-muted-foreground text-xs" />
      ) : (
        <p className="min-h-4 px-2 text-destructive text-xs">{drop.rejected}</p>
      )}
    </div>
  );
}

function AssetsBody({
  assets,
  error,
  isLoading,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
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

  if (assets.length === 0) {
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

  return (
    <div className="grid grid-cols-2 gap-2 px-1 pb-1">
      {assets.map((asset) => (
        <AssetItem
          asset={asset}
          key={asset.slug}
          onPick={onPick}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function AssetTile({
  asset,
  preview,
}: {
  asset: Asset;
  preview: ReturnType<typeof usePreviewImage>;
}) {
  const playable = playableFileOf(asset);

  if (preview.src !== null) {
    return (
      // biome-ignore lint/performance/noImgElement: a file on disk, which next/image cannot serve from a static export
      // biome-ignore lint/correctness/useImageSize: the tile fixes the box and the picture is cropped into it
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction
      <img alt="" onError={preview.onError} src={preview.src} />
    );
  }

  const source = playable === null ? null : previewUrl(playable);

  if (source !== null) {
    return <VideoThumbnail src={source} />;
  }

  return (
    <AssetTypeIcon className="size-4 text-muted-foreground" type={asset.type} />
  );
}

function AssetRowItem({
  asset,
  onPick,
  onRemove,
}: {
  asset: Asset;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = usePreviewImage(asset.preview ?? "");
  const length = asset.duration === null ? null : clipTime(asset.duration);

  return (
    <Attachment
      className="border-none bg-transparent"
      orientation="vertical"
      title={asset.description.length > 0 ? asset.description : asset.name}
    >
      <AttachmentTrigger
        aria-label={`${asset.name}, ${ASSET_TYPE_LABELS[asset.type]}`}
        onClick={onPick}
        value={asset.slug}
      />

      <AttachmentActions>
        <AttachmentAction
          aria-label={`Delete ${asset.name}`}
          className="bg-black/60 text-white opacity-0 hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover/attachment:opacity-100"
          onClick={onRemove}
          value={asset.slug}
        >
          <Trash2Icon />
        </AttachmentAction>
      </AttachmentActions>

      <AttachmentMedia variant="image">
        <AssetTile asset={asset} preview={preview} />
      </AttachmentMedia>

      <AttachmentContent>
        <AttachmentTitle>{asset.name}</AttachmentTitle>
        {length === null ? null : (
          <AttachmentDescription>
            <span className="absolute top-1 left-1 rounded bg-black/70 px-1 py-px font-medium text-[10px] text-white tabular-nums">
              {length}
            </span>
          </AttachmentDescription>
        )}
      </AttachmentContent>
    </Attachment>
  );
}

const AssetItem = memo(AssetRowItem);
