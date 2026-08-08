import { describe, expect, it } from "vitest";
import {
  COLUMN,
  DOCK_GAP,
  dockFor,
  dockOf,
  gutterOf,
  ICON_SLOT,
  PANEL_MAX,
  PANEL_MIN,
} from "@/lib/studio/dock";

describe("gutterOf", () => {
  it("is what the centred column leaves on one side", () => {
    expect(gutterOf(COLUMN + 400)).toBe(200);
  });

  it("is nothing at all once the column fills the pane", () => {
    expect(gutterOf(COLUMN)).toBe(0);
    expect(gutterOf(400)).toBe(0);
    expect(gutterOf(0)).toBe(0);
  });
});

describe("dockFor", () => {
  it("shows the whole block when the gutter fits it", () => {
    expect(dockFor(PANEL_MAX + DOCK_GAP + 100)).toEqual({
      mode: "panel",
      width: PANEL_MAX,
    });
  });

  it("narrows the block rather than dropping it, down to half its width", () => {
    expect(dockFor(PANEL_MIN + DOCK_GAP + 20)).toEqual({
      mode: "panel",
      width: PANEL_MIN + 20,
    });
    expect(dockFor(PANEL_MIN + DOCK_GAP)).toEqual({
      mode: "panel",
      width: PANEL_MIN,
    });
  });

  it("collapses to the icon once half the block no longer fits", () => {
    expect(dockFor(PANEL_MIN + DOCK_GAP - 1).mode).toBe("icon");
    expect(dockFor(ICON_SLOT + DOCK_GAP).mode).toBe("icon");
  });

  it("hides everything, icon included, when even that has no room", () => {
    expect(dockFor(ICON_SLOT + DOCK_GAP - 1)).toEqual({
      mode: "hidden",
      width: 0,
    });
    expect(dockFor(0).mode).toBe("hidden");
  });

  it("never reports a width for a mode that draws no panel", () => {
    expect(dockFor(ICON_SLOT + DOCK_GAP).width).toBe(0);
  });
});

describe("dockOf", () => {
  it("reads the pane's width, not the gutter's", () => {
    const wide = COLUMN + 2 * (PANEL_MAX + DOCK_GAP);
    expect(dockOf(wide)).toEqual({ mode: "panel", width: PANEL_MAX });
    expect(dockOf(COLUMN + 2 * (ICON_SLOT + DOCK_GAP)).mode).toBe("icon");
    expect(dockOf(COLUMN).mode).toBe("hidden");
  });

  it("is hidden before anything has been measured", () => {
    expect(dockOf(0).mode).toBe("hidden");
  });
});
