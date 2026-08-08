export type DockMode = "hidden" | "icon" | "panel";

export interface Dock {
  mode: DockMode;
  width: number;
}

export const COLUMN = 672;

// The natural width of the block, and the floor below which a wrapped 14px
// line stops being worth reading — roughly half of it, which is where the
// block gives up and collapses into the button.
export const PANEL_MAX = 288;

export const PANEL_MIN = 176;

export const ICON_SLOT = 44;

export const DOCK_GAP = 12;

const HIDDEN: Dock = { mode: "hidden", width: 0 };

export function gutterOf(pane: number, column: number = COLUMN): number {
  return Math.max(0, (pane - Math.min(pane, column)) / 2);
}

export function dockFor(gutter: number): Dock {
  const room = gutter - DOCK_GAP;

  if (room >= PANEL_MIN) {
    return { mode: "panel", width: Math.min(room, PANEL_MAX) };
  }

  return room >= ICON_SLOT ? { mode: "icon", width: 0 } : HIDDEN;
}

export function dockOf(pane: number, column: number = COLUMN): Dock {
  return dockFor(gutterOf(pane, column));
}
