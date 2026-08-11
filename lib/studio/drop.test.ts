import { describe, expect, it } from "vitest";
import { isInside, refusalOf } from "@/lib/studio/drop";

const PANE = { bottom: 700, left: 0, right: 240, top: 100 };

describe("isInside", () => {
  it("reads a retina drop against a box measured in CSS pixels", () => {
    expect(isInside(PANE, { x: 240, y: 400 }, 2)).toBe(true);
    expect(isInside(PANE, { x: 600, y: 400 }, 2)).toBe(false);
  });

  it("takes the physical pixels as they are on a plain display", () => {
    expect(isInside(PANE, { x: 120, y: 400 }, 1)).toBe(true);
    expect(isInside(PANE, { x: 300, y: 400 }, 1)).toBe(false);
  });

  it("keeps the header out of the pane, which starts below it", () => {
    expect(isInside(PANE, { x: 100, y: 100 }, 2)).toBe(false);
    expect(isInside(PANE, { x: 100, y: 220 }, 2)).toBe(true);
  });

  it("counts the edges as inside, so a drop on the border still lands", () => {
    expect(isInside(PANE, { x: 0, y: 200 }, 1)).toBe(true);
    expect(isInside(PANE, { x: 240, y: 700 }, 1)).toBe(true);
  });

  it("is false when there is no box or no pointer to compare", () => {
    expect(isInside(null, { x: 10, y: 200 }, 1)).toBe(false);
    expect(isInside(PANE, null, 1)).toBe(false);
  });

  it("treats a nonsense ratio as one rather than dividing by zero", () => {
    expect(isInside(PANE, { x: 120, y: 400 }, 0)).toBe(true);
  });
});

describe("refusalOf", () => {
  it("says nothing when everything dropped was usable", () => {
    expect(refusalOf([])).toBeNull();
  });

  it("names the one thing that was not media", () => {
    expect(refusalOf(["/tmp/notes.md"])).toContain("That is not a picture");
  });

  it("counts them when several were not", () => {
    expect(refusalOf(["/a.md", "/b.txt", "/c.zip"])).toContain("3 of those");
  });
});
