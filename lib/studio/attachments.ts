import type { ImageMediaType, PromptAttachment } from "@/shared/ipc";
import { baseName } from "./paths";

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function attachmentOf(path: string): PromptAttachment | null {
  const name = baseName(path);
  const mediaType = MEDIA_TYPES[extensionOf(name)];

  return mediaType === undefined || name.length === 0
    ? null
    : { mediaType, name, path };
}

export function mediaLabel(mediaType: ImageMediaType): string {
  return mediaType.replace("image/", "").toUpperCase();
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}
