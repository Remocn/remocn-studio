"use client";

import type { MouseEvent } from "react";
import { memo } from "react";
import { Trash2Icon } from "@/components/icons";
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
import { cn } from "@/lib/utils";
import {
  ASSET_TYPE_LABELS,
  type Asset,
  isBundledSlug,
  playableFileOf,
} from "@/shared/library";
import { AssetTypeIcon } from "./asset-type-icon";
import { SoundAsset } from "./sound-asset";
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
  const grouped = [
    ...assets.filter((asset) => asset.type !== "audio"),
    ...assets.filter((asset) => asset.type === "audio"),
  ];
  return (
    <ul
      aria-label="Asset library"
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] items-start gap-3 px-1 pb-1"
    >
      {grouped.map((asset) => (
        <li
          className={cn("min-w-0", asset.type === "audio" && "col-span-full")}
          key={asset.slug}
        >
          <AssetItem
            asset={asset}
            onPick={onPick}
            onRemove={isBundledSlug(asset.slug) ? undefined : onRemove}
          />
        </li>
      ))}
    </ul>
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
      <img
        alt=""
        decoding="async"
        loading="lazy"
        onError={preview.onError}
        src={preview.src}
      />
    );
  }

  const source = playable === null ? null : previewUrl(playable);

  if (source !== null) {
    return <VideoThumbnail src={source} />;
  }

  return (
    <AssetTypeIcon className="size-6 text-muted-foreground" type={asset.type} />
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

  if (asset.type === "audio") {
    return <SoundAsset asset={asset} onPick={onPick} onRemove={onRemove} />;
  }

  const card = (
    // No `title` here on purpose: the native tooltip pops over the hover
    // preview card, and the name is already printed under the tile.
    <Attachment
      className="w-full gap-2 bg-transparent has-data-[slot=attachment-content]:w-full has-data-[slot=attachment-content]:p-0 has-data-[slot=attachment-media]:p-0"
      orientation="vertical"
    >
      <AttachmentTrigger
        aria-label={`${asset.name}, ${ASSET_TYPE_LABELS[asset.type]}`}
        onClick={onPick}
        value={asset.slug}
      />

      {onRemove === undefined ? null : (
        <AttachmentActions className="group-data-[orientation=vertical]/attachment:top-1 group-data-[orientation=vertical]/attachment:right-1">
          <AttachmentAction
            aria-label={`Delete ${asset.name}`}
            className="relative bg-black/60 text-white opacity-0 pointer-coarse:opacity-100 after:absolute after:-inset-1 hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover/attachment:opacity-100"
            onClick={onRemove}
            value={asset.slug}
          >
            <Trash2Icon />
          </AttachmentAction>
        </AttachmentActions>
      )}

      <AttachmentMedia
        className="aspect-[5/3] rounded-xl *:[img]:aspect-auto *:[img]:h-full *:[video]:h-full *:[video]:w-full *:[video]:object-cover"
        variant="image"
      >
        <AssetTile asset={asset} preview={preview} />
        {length === null ? null : (
          <span className="absolute top-1 left-1 rounded-sm bg-black/70 px-1 py-px font-medium text-2xs text-white tabular-nums">
            {length}
          </span>
        )}
      </AttachmentMedia>

      <AttachmentContent className="w-full group-data-[orientation=vertical]/attachment:px-0">
        <AttachmentTitle className="font-normal text-xs/4">
          {asset.name}
        </AttachmentTitle>
        <AttachmentDescription className="mt-2 text-xs/4">
          {ASSET_TYPE_LABELS[asset.type]}
        </AttachmentDescription>
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
