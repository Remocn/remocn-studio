import type { Asset } from "@/shared/library";

export const PANE_VIEWS = ["projects", "assets", "components"] as const;

export type PaneView = (typeof PANE_VIEWS)[number];

export function isPaneView(value: string | undefined): value is PaneView {
  return PANE_VIEWS.includes(value as PaneView);
}

export type SlideDirection = "push" | "pop" | "none";

// Projects is the root: entering any other view pushes, coming back pops.
// Assets and Components slide by their order in the menu.
export function slideDirection(
  from: PaneView | null,
  to: PaneView
): SlideDirection {
  if (from === null || from === to) {
    return "none";
  }
  return PANE_VIEWS.indexOf(to) > PANE_VIEWS.indexOf(from) ? "push" : "pop";
}

export function filterAssets(
  assets: readonly Asset[],
  query: string
): readonly Asset[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return assets;
  }
  return assets.filter((asset) => asset.name.toLowerCase().includes(needle));
}
