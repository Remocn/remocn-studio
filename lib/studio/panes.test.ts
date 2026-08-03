import { describe, expect, it } from "vitest";
import { panelIdsOf, showsPreview } from "@/lib/studio/panes";

describe("showsPreview", () => {
  it("hides the preview when there is nothing to preview", () => {
    expect(showsPreview(null, false, false)).toBe(false);
  });

  it("shows it once a project exists", () => {
    expect(showsPreview(null, true, false)).toBe(true);
  });

  it("shows it while the projects are still loading", () => {
    expect(showsPreview(null, false, true)).toBe(true);
  });

  it("keeps a chosen state whatever the projects say", () => {
    expect(showsPreview(false, true, false)).toBe(false);
    expect(showsPreview(true, false, false)).toBe(true);
  });
});

describe("panelIdsOf", () => {
  it("names the panes that are on screen, in order", () => {
    expect(panelIdsOf(true, true)).toEqual(["projects", "chat", "preview"]);
    expect(panelIdsOf(true, false)).toEqual(["projects", "chat"]);
    expect(panelIdsOf(false, true)).toEqual(["chat", "preview"]);
    expect(panelIdsOf(false, false)).toEqual(["chat"]);
  });

  // The library reads these as a dependency, so a fresh array per render would
  // recompute the stored layout on every one.
  it("answers the same array for the same panes", () => {
    expect(panelIdsOf(true, true)).toBe(panelIdsOf(true, true));
  });
});
