// The sidebar is a fixed-width column outside the resizable group, so the
// layout holds the chat and the preview. Each combination is its own id list,
// which is what keeps the stored width of a one-pane window from being read as
// a two-pane one.
const WITH_PREVIEW = ["chat", "preview"];
const CHAT_ALONE = ["chat"];

export function showsPreview(
  chosen: boolean | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): boolean {
  return chosen ?? (isLoadingProjects || hasProjects);
}

export function panelIdsOf(isPreviewShown: boolean): string[] {
  return isPreviewShown ? WITH_PREVIEW : CHAT_ALONE;
}

export const CHAT_MIN_WIDTH = 380;
export const INSPECTOR_WIDTH = 340;
export const INSPECTOR_BAR_WIDTH = 48;
export const RULER_WIDTH = 20;
export const SIDEBAR_WIDTH = 238;

export const CANVAS_MIN_WIDTH = 400;
const CANVAS_LEAD_WIDTH = 100;

export const PREVIEW_MIN_WIDTH =
  RULER_WIDTH + CANVAS_MIN_WIDTH + INSPECTOR_BAR_WIDTH;

const CARD_INSET = 8;
const DIVIDER_WIDTH = 1;

// The inspector lives inside the preview, so a preview at its own minimum was
// a sliver of canvas beside it. The room is the open inspector plus a canvas,
// rulers included, wide enough for the toolbar and the pane's actions to share
// their row and for the playback dock to keep its controls.
const CANVAS_ROOM = 500;
export const PREVIEW_ROOM = INSPECTOR_WIDTH + CANVAS_ROOM;

/**
 * The width to widen the preview to so the chat yields first: its room, or as
 * much of it as the chat can give without going below its own minimum. `null`
 * when the preview already has that — it is never narrowed from here.
 */
export function previewRoom(
  previewWidth: number,
  groupWidth: number
): number | null {
  const room = Math.min(PREVIEW_ROOM, groupWidth - CHAT_MIN_WIDTH);

  return room - previewWidth > 1 ? room : null;
}

export function inspectorHasRoom(
  previewWidth: number,
  isLeftmost: boolean
): boolean {
  const canvas = CANVAS_MIN_WIDTH + (isLeftmost ? CANVAS_LEAD_WIDTH : 0);

  return previewWidth >= RULER_WIDTH + canvas + INSPECTOR_WIDTH;
}

export interface PaneFit {
  chat: boolean;
  projects: boolean;
}

export function fitPanes(
  windowWidth: number,
  isPreviewShown: boolean
): PaneFit {
  if (!isPreviewShown) {
    return {
      chat: true,
      projects: windowWidth >= SIDEBAR_WIDTH + CARD_INSET + CHAT_MIN_WIDTH,
    };
  }

  const beside =
    CHAT_MIN_WIDTH +
    DIVIDER_WIDTH +
    RULER_WIDTH +
    CANVAS_MIN_WIDTH +
    INSPECTOR_WIDTH;

  return {
    chat:
      windowWidth >=
      2 * CARD_INSET + CHAT_MIN_WIDTH + DIVIDER_WIDTH + PREVIEW_MIN_WIDTH,
    projects: windowWidth >= SIDEBAR_WIDTH + CARD_INSET + beside,
  };
}
