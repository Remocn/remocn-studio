import type { PromptMedia } from "@/shared/ipc";
import { mediaOf } from "./attachments";

export interface DropPoint {
  readonly x: number;
  readonly y: number;
}

export interface DropBox {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// Tauri reports the pointer in physical pixels from the window's top-left. The
// webview fills the window — the title bar is an overlay — so dividing by the
// device ratio lands in the same client coordinates an element's box is in.
export function isInside(
  box: DropBox | null,
  point: DropPoint | null,
  ratio: number
): boolean {
  if (box === null || point === null) {
    return false;
  }

  const scale = ratio > 0 ? ratio : 1;
  const x = point.x / scale;
  const y = point.y / scale;

  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

export interface DropZone<Name extends string = string> {
  readonly box: DropBox | null;
  readonly name: Name;
}

export function zoneAt<Name extends string>(
  zones: readonly DropZone<Name>[],
  point: DropPoint | null,
  ratio: number
): Name | null {
  const found = zones.find((zone) => isInside(zone.box, point, ratio));

  return found?.name ?? null;
}

export interface MediaDrop {
  readonly kept: PromptMedia[];
  readonly skipped: string[];
}

export function mediaDrop(paths: readonly string[]): MediaDrop {
  const kept: PromptMedia[] = [];
  const skipped: string[] = [];

  for (const path of paths) {
    const found = mediaOf(path);
    if (found === null) {
      skipped.push(path);
      continue;
    }
    kept.push(found);
  }

  return { kept, skipped };
}

export function refusalOf(
  skipped: readonly string[],
  destination: string
): string | null {
  if (skipped.length === 0) {
    return null;
  }

  return skipped.length === 1
    ? `That is not a picture, a video or a sound, so it did not go into ${destination}.`
    : `${skipped.length} of those are not pictures, video or sound, so they did not go into ${destination}.`;
}
