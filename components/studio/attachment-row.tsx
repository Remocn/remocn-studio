"use client";

import { ImageIcon, XIcon } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
  AttachmentMedia,
} from "@/components/ui/attachment";
import { usePreviewImage } from "@/hooks/use-preview-image";
import type { PromptAttachment } from "@/shared/ipc";

export function AttachmentRow({
  items,
  onRemove,
}: {
  items: readonly PromptAttachment[];
  onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AttachmentGroup>
      {items.map((item, index) => (
        <AttachmentCard
          index={index}
          item={item}
          key={item.path}
          onRemove={onRemove}
        />
      ))}
    </AttachmentGroup>
  );
}

function AttachmentCard({
  index,
  item,
  onRemove,
}: {
  index: number;
  item: PromptAttachment;
  onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = usePreviewImage(item.path);

  return (
    <Attachment
      className="border-none bg-muted"
      orientation="vertical"
      title={item.name}
    >
      <AttachmentMedia variant={preview.src === null ? "icon" : "image"}>
        {preview.src === null ? (
          <ImageIcon />
        ) : (
          // biome-ignore lint/performance/noImgElement: a file on disk, which next/image cannot serve from a static export
          // biome-ignore lint/correctness/useImageSize: the card fixes the box and the picture is cropped into it
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction
          <img alt={item.name} onError={preview.onError} src={preview.src} />
        )}
      </AttachmentMedia>
      {onRemove ? (
        <AttachmentActions>
          <AttachmentAction
            aria-label={`Remove ${item.name}`}
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
