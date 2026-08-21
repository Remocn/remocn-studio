import { describe, expect, it } from "vitest";
import {
  componentGroups,
  filterAssets,
  isPaneView,
  slideDirection,
} from "@/lib/studio/pane-view";
import type { Asset } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";

function asset(name: string, shape: Partial<Asset> = {}): Asset {
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
    role: null,
    slug: name.toLowerCase(),
    source: null,
    type: "component",
    ...shape,
  };
}

function bundled(
  name: string,
  role: MotionRole,
  category: string | null
): Asset {
  return asset(name, { category, role, slug: `remocn/${name.toLowerCase()}` });
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

describe("componentGroups", () => {
  it("groups by role, in the order a life runs", () => {
    const groups = componentGroups(
      [],
      [
        bundled("Whip Pan", "transition", "Transitions"),
        bundled("Soft Blur In", "entry", "Typography"),
        bundled("Shimmer Sweep", "emphasis", "Typography"),
      ]
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Entry",
      "Emphasis",
      "Transition",
    ]);
  });

  it("orders a role's tiles by category, so Scene reads shaders before filters", () => {
    const [scene] = componentGroups(
      [],
      [
        bundled("VHS Filter", "scene", "Filters"),
        bundled("Shader Water", "scene", "Shaders"),
      ]
    );

    expect(scene?.assets.map((found) => found.name)).toEqual([
      "Shader Water",
      "VHS Filter",
    ]);
  });

  it("puts the person's own behaviours ahead of the shipped ones in their role", () => {
    const [entry] = componentGroups(
      [asset("My Reveal", { role: "entry" })],
      [bundled("Soft Blur In", "entry", "Typography")]
    );

    expect(entry?.assets.map((found) => found.name)).toEqual([
      "My Reveal",
      "Soft Blur In",
    ]);
  });

  it("keeps a saved component with no role under Saved, ahead of every role", () => {
    const groups = componentGroups(
      [asset("Old Scene")],
      [bundled("Soft Blur In", "entry", "Typography")]
    );

    expect(groups.map((group) => group.label)).toEqual(["Saved", "Entry"]);
  });

  it("renders no heading for a role nothing is in", () => {
    expect(componentGroups([], [])).toEqual([]);
  });
});
