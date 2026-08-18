"use client";

import { AudioLinesIcon, LibraryBigIcon, XIcon } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
  AttachmentMedia,
} from "@/components/ui/attachment";
import { usePreviewImage } from "@/hooks/use-preview-image";
import type { PromptMedia } from "@/shared/ipc";
import { VideoThumbnail } from "./video-thumbnail";

type Handler = (event: React.MouseEvent<HTMLButtonElement>) => void;

export function MediaRow({
  items,
  onKeep,
  onRemove,
}: {
  items: readonly PromptMedia[];
  onKeep?: Handler;
  onRemove?: Handler;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AttachmentGroup>
      {items.map((item, index) => (
        <MediaCard
          index={index}
          item={item}
          key={item.path}
          onKeep={onKeep}
          onRemove={onRemove}
        />
      ))}
    </AttachmentGroup>
  );
}

function MediaCard({
  index,
  item,
  onKeep,
  onRemove,
}: {
  index: number;
  item: PromptMedia;
  onKeep?: Handler;
  onRemove?: Handler;
}) {
  const preview = usePreviewImage(item.path);
  const kind = kindOf(item);
  const shown = kind !== "audio" && preview.src !== null;

  return (
    <Attachment
      className="border-none bg-muted"
      orientation="vertical"
      title={item.name}
    >
      {/* The hairline goes on the media box, not the picture: the box owns the
          radius and clips what is inside it, so an outline on the image itself
          would square off the corners it is meant to trace. */}
      <AttachmentMedia
        className={
          shown
            ? "outline-1 outline-black/10 -outline-offset-1 dark:outline-white/10"
            : undefined
        }
        variant={shown ? "image" : "icon"}
      >
        <Thumbnail item={item} kind={kind} preview={preview} shown={shown} />
      </AttachmentMedia>

      {onKeep || onRemove ? (
        <AttachmentActions>
          {onKeep ? (
            <AttachmentAction
              aria-label={`Save ${item.name} to the library`}
              className="relative after:absolute after:-inset-y-1"
              onClick={onKeep}
              value={String(index)}
              variant="secondary"
            >
              <LibraryBigIcon />
            </AttachmentAction>
          ) : null}
          {onRemove ? (
            <AttachmentAction
              aria-label={`Remove ${item.name}`}
              className="relative after:absolute after:-inset-y-1"
              onClick={onRemove}
              value={String(index)}
              variant="secondary"
            >
              <XIcon />
            </AttachmentAction>
          ) : null}
        </AttachmentActions>
      ) : null}
    </Attachment>
  );
}

function Thumbnail({
  item,
  kind,
  preview,
  shown,
}: {
  item: PromptMedia;
  kind: "audio" | "image" | "video";
  preview: ReturnType<typeof usePreviewImage>;
  shown: boolean;
}) {
  if (!shown) {
    return <AudioLinesIcon />;
  }

  if (kind === "video") {
    return <VideoThumbnail onError={preview.onError} src={preview.src ?? ""} />;
  }

  return (
    // biome-ignore lint/performance/noImgElement: a file on disk, which next/image cannot serve from a static export
    // biome-ignore lint/correctness/useImageSize: the card fixes the box and the picture is cropped into it
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction
    <img alt={item.name} onError={preview.onError} src={preview.src ?? ""} />
  );
}

function kindOf(item: PromptMedia): "audio" | "image" | "video" {
  if (item.mediaType.startsWith("video/")) {
    return "video";
  }
  return item.mediaType.startsWith("audio/") ? "audio" : "image";
}
