"use client";

import { XIcon } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
  AttachmentMedia,
} from "@/components/ui/attachment";
import { usePreviewImage } from "@/hooks/use-preview-image";
import { ASSET_TYPE_LABELS, type PromptAsset } from "@/shared/library";
import { AssetTypeIcon } from "./asset-type-icon";

export function AssetRow({
  items,
  onRemove,
}: {
  items: readonly PromptAsset[];
  onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AttachmentGroup>
      {items.map((item, index) => (
        <AssetCard
          index={index}
          item={item}
          key={item.slug}
          onRemove={onRemove}
        />
      ))}
    </AttachmentGroup>
  );
}

function AssetCard({
  index,
  item,
  onRemove,
}: {
  index: number;
  item: PromptAsset;
  onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = usePreviewImage(item.preview ?? "");
  const label = `${item.name} — ${ASSET_TYPE_LABELS[item.type]}`;

  return (
    <Attachment
      className="border-none bg-muted"
      orientation="vertical"
      title={label}
    >
      <AttachmentMedia
        className={
          preview.src === null
            ? undefined
            : "outline-1 outline-black/10 -outline-offset-1 dark:outline-white/10"
        }
        variant={preview.src === null ? "icon" : "image"}
      >
        {preview.src === null ? (
          <AssetTypeIcon type={item.type} />
        ) : (
          // biome-ignore lint/performance/noImgElement: a file on disk, which next/image cannot serve from a static export
          // biome-ignore lint/correctness/useImageSize: the card fixes the box and the picture is cropped into it
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction
          <img alt={label} onError={preview.onError} src={preview.src} />
        )}
      </AttachmentMedia>
      {onRemove ? (
        <AttachmentActions>
          <AttachmentAction
            aria-label={`Remove ${item.name}`}
            className="relative after:absolute after:-inset-1"
            onClick={onRemove}
            value={String(index)}
            variant="secondary"
          >
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      ) : null}
    </Attachment>
  );
}
