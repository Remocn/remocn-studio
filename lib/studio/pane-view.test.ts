import { describe, expect, it } from "vitest";
import {
  filterAssets,
  isPaneView,
  slideDirection,
} from "@/lib/studio/pane-view";
import type { Asset } from "@/shared/library";

function asset(name: string): Asset {
  return {
    category: null,
    clip: null,
    createdAt: 1,
    dependencies: [],
    description: "",
    duration: null,
    files: ["Neon.tsx"],
    name,
    path: "/library/assets/x",
    preview: null,
    proxied: false,
    slug: name.toLowerCase(),
    type: "component",
  };
}

describe("isPaneView", () => {
  it("accepts the three views and nothing else", () => {
    expect(isPaneView("projects")).toBe(true);
    expect(isPaneView("assets")).toBe(true);
    expect(isPaneView("components")).toBe(true);
    expect(isPaneView("drawer")).toBe(false);
    expect(isPaneView(undefined)).toBe(false);
  });
});

describe("slideDirection", () => {
  it("pushes when leaving the root, pops on the way back", () => {
    expect(slideDirection("projects", "assets")).toBe("push");
    expect(slideDirection("assets", "projects")).toBe("pop");
  });

  it("slides Assets and Components by their order in the menu", () => {
    expect(slideDirection("assets", "components")).toBe("push");
    expect(slideDirection("components", "assets")).toBe("pop");
  });

  it("does not animate the first view or a repeat", () => {
    expect(slideDirection(null, "projects")).toBe("none");
    expect(slideDirection("assets", "assets")).toBe("none");
  });
});

describe("filterAssets", () => {
  const assets = [asset("Neon Title"), asset("Aurora"), asset("Grid Fade")];

  it("matches by name, case-insensitively", () => {
    expect(filterAssets(assets, "neon").map((found) => found.name)).toEqual([
      "Neon Title",
    ]);
  });

  it("returns everything for a blank query", () => {
    expect(filterAssets(assets, "  ")).toEqual(assets);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterAssets(assets, "shader")).toEqual([]);
  });
});
