import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageMediaType, PromptAttachment } from "@/shared/ipc";
import { baseName } from "./paths";

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const SUPPORTED = new Set<string>(Object.values(MEDIA_TYPES));

export function attachmentOf(path: string): PromptAttachment | null {
  const name = baseName(path);
  const mediaType = MEDIA_TYPES[extensionOf(name)];

  return mediaType === undefined || name.length === 0
    ? null
    : { mediaType, name, path };
}

export function isImageMediaType(value: string): value is ImageMediaType {
  return SUPPORTED.has(value);
}

export function previewUrl(path: string): string | null {
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}
