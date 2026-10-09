import type { Asset } from "@/shared/library";
import { MOTION_ROLES, type MotionRole, ROLE_LABELS } from "@/shared/motion";

export const PANE_VIEWS = [
  "videos",
  "projects",
  "assets",
  "components",
  "shaders",
  "captions",
] as const;

export type PaneView = (typeof PANE_VIEWS)[number];

export function isPaneView(value: string | undefined): value is PaneView {
  return PANE_VIEWS.includes(value as PaneView);
}

export type SlideDirection = "push" | "pop" | "none";

// Videos is the root: entering any other view pushes, coming back pops.
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

export const CATEGORY_ORDER = [
  "Typography",
  "Transitions",
  "Shaders",
  "Filters",
  "Effects",
] as const;

export const SAVED_LABEL = "Saved";

export interface ComponentGroup {
  readonly assets: readonly Asset[];
  readonly label: string;
}

function categoryRank(asset: Asset): number {
  const found = CATEGORY_ORDER.indexOf(
    asset.category as (typeof CATEGORY_ORDER)[number]
  );
  return found === -1 ? CATEGORY_ORDER.length : found;
}

function byCategory(assets: readonly Asset[]): readonly Asset[] {
  return [...assets].sort(
    (one, other) => categoryRank(one) - categoryRank(other)
  );
}

function inRole(assets: readonly Asset[], role: MotionRole): readonly Asset[] {
  return assets.filter((asset) => asset.role === role);
}

export function componentGroups(
  saved: readonly Asset[],
  bundled: readonly Asset[]
): readonly ComponentGroup[] {
  const savedComponents = saved.filter(
    (asset) => asset.category !== "Shaders" && asset.category !== "Captions"
  );
  const bundledComponents = bundled.filter(
    (asset) => asset.category !== "Shaders" && asset.category !== "Captions"
  );
  const unsorted = savedComponents.filter((asset) => asset.role === null);

  const groups: ComponentGroup[] = MOTION_ROLES.map((role) => ({
    assets: [
      ...inRole(savedComponents, role),
      ...byCategory(inRole(bundledComponents, role)),
    ],
    label: ROLE_LABELS[role],
  }));

  return [{ assets: unsorted, label: SAVED_LABEL }, ...groups].filter(
    (group) => group.assets.length > 0
  );
}

export function captionAssets(assets: readonly Asset[]): readonly Asset[] {
  return assets.filter((asset) => asset.category === "Captions");
}

export function captionSelectionUnavailable({
  hasProject,
  missing,
  blocked,
  waiting,
}: {
  hasProject: boolean;
  missing: boolean;
  blocked: boolean;
  waiting: boolean;
}): string | null {
  if (!hasProject) {
    return "Open a video to add a caption style.";
  }
  if (missing) {
    return "Locate the project folder to add a caption style.";
  }
  if (blocked) {
    return "Complete the project setup to add a caption style.";
  }
  if (waiting) {
    return "Answer the request in chat to add a caption style.";
  }
  return null;
}
