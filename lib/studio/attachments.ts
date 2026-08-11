import { convertFileSrc } from "@tauri-apps/api/core";
import {
  IMAGE_MEDIA_TYPES,
  type ImageMediaType,
  MEDIA_TYPES,
  type MediaType,
  type PromptAttachment,
  type PromptMedia,
} from "@/shared/ipc";
import { baseName } from "./paths";

const MEDIA_BY_EXTENSION: Record<string, MediaType> = {
  aac: "audio/aac",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  png: "image/png",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

const IMAGES = new Set<string>(IMAGE_MEDIA_TYPES);
const SUPPORTED = new Set<string>(MEDIA_TYPES);

export const MEDIA_EXTENSIONS = Object.keys(MEDIA_BY_EXTENSION);

export const IMAGE_EXTENSIONS = MEDIA_EXTENSIONS.filter((extension) =>
  IMAGES.has(MEDIA_BY_EXTENSION[extension] ?? "")
);

export const PLAYABLE_EXTENSIONS = MEDIA_EXTENSIONS.filter(
  (extension) => !IMAGES.has(MEDIA_BY_EXTENSION[extension] ?? "")
);

export function mediaOf(path: string): PromptMedia | null {
  const name = baseName(path);
  const mediaType = MEDIA_BY_EXTENSION[extensionOf(name)];

  return mediaType === undefined || name.length === 0
    ? null
    : { mediaType, name, path };
}

export function attachmentOf(path: string): PromptAttachment | null {
  const found = mediaOf(path);

  return found === null || !isImageMediaType(found.mediaType)
    ? null
    : { mediaType: found.mediaType, name: found.name, path: found.path };
}

export function isImageMediaType(value: string): value is ImageMediaType {
  return IMAGES.has(value);
}

export function isMediaType(value: string): value is MediaType {
  return SUPPORTED.has(value);
}

export function isPlayable(mediaType: MediaType): boolean {
  return !IMAGES.has(mediaType);
}

export function previewUrl(path: string): string | null {
  if (path.length === 0) {
    return null;
  }

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
