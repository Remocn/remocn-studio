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

export function refusalOf(skipped: readonly string[]): string | null {
  if (skipped.length === 0) {
    return null;
  }

  return skipped.length === 1
    ? "That is not a picture, a video or a sound, so it did not go into the library."
    : `${skipped.length} of those are not pictures, video or sound, so they did not go into the library.`;
}
