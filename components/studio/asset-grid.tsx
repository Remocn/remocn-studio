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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useClipFallback } from "@/hooks/use-hover-clip";
import { usePreviewImage } from "@/hooks/use-preview-image";
import { previewUrl } from "@/lib/studio/attachments";
import { clipTime } from "@/lib/studio/time";
import {
  ASSET_TYPE_LABELS,
  type Asset,
  isBundledSlug,
  playableFileOf,
} from "@/shared/library";
import { AssetTypeIcon } from "./asset-type-icon";
import { VideoThumbnail } from "./video-thumbnail";

export function AssetGrid({
  assets,
  onPick,
  onRemove,
}: {
  assets: readonly Asset[];
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 px-1 pb-1">
      {assets.map((asset) => (
        <AssetItem
          asset={asset}
          key={asset.slug}
          onPick={onPick}
          onRemove={isBundledSlug(asset.slug) ? undefined : onRemove}
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
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = usePreviewImage(asset.preview ?? "");
  const length = asset.duration === null ? null : clipTime(asset.duration);

  const card = (
    // No `title` here on purpose: the native tooltip pops over the hover
    // preview card, and the name is already printed under the tile.
    <Attachment className="border-none bg-transparent" orientation="vertical">
      <AttachmentTrigger
        aria-label={`${asset.name}, ${ASSET_TYPE_LABELS[asset.type]}`}
        onClick={onPick}
        value={asset.slug}
      />

      {onRemove === undefined ? null : (
        <AttachmentActions>
          <AttachmentAction
            aria-label={`Delete ${asset.name}`}
            className="relative bg-black/60 text-white opacity-0 after:absolute after:-inset-1 hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover/attachment:opacity-100"
            onClick={onRemove}
            value={asset.slug}
          >
            <Trash2Icon />
          </AttachmentAction>
        </AttachmentActions>
      )}

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

  const clipSource = asset.clip === null ? null : previewUrl(asset.clip);

  if (clipSource === null) {
    return card;
  }

  return (
    <ClipPopover poster={preview.src} src={clipSource}>
      {card}
    </ClipPopover>
  );
}

// The moving preview does not replace the tile — it opens beside it, larger,
// after the pointer has settled, so sweeping the grid starts no decoders and
// the card itself never flickers. A clip that will not play degrades to the
// poster, and to nothing the card was not already showing.
function ClipPopover({
  children,
  poster,
  src,
}: {
  children: React.ReactNode;
  poster: string | null;
  src: string;
}) {
  const clip = useClipFallback();

  let shown: React.ReactNode = (
    <video
      autoPlay
      className="w-full rounded-sm"
      loop
      muted
      onError={clip.onError}
      playsInline
      ref={clip.ref}
      src={src}
    />
  );

  if (clip.isBroken) {
    shown =
      poster === null ? null : (
        // biome-ignore lint/performance/noImgElement: a file on disk, which next/image cannot serve from a static export
        // biome-ignore lint/correctness/useImageSize: the popover fixes the box and the picture is cropped into it
        <img alt="" className="w-full rounded-sm" src={poster} />
      );
  }

  return (
    <HoverCard>
      <HoverCardTrigger delay={150} render={<div className="min-w-0" />}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 overflow-hidden p-1" side="right">
        {shown}
      </HoverCardContent>
    </HoverCard>
  );
}

export const AssetItem = memo(AssetRowItem);
