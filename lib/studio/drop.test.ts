import { describe, expect, it } from "vitest";
import {
  type DropZone,
  isInside,
  mediaDrop,
  refusalOf,
  zoneAt,
} from "@/lib/studio/drop";

const PANE = { bottom: 700, left: 0, right: 240, top: 100 };

const COMPOSER = { bottom: 690, left: 300, right: 900, top: 560 };

const ZONES: readonly DropZone<"composer" | "library">[] = [
  { box: COMPOSER, name: "composer" },
  { box: PANE, name: "library" },
];

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

describe("zoneAt", () => {
  it("names the zone the drop landed in", () => {
    expect(zoneAt(ZONES, { x: 1200, y: 1250 }, 2)).toBe("composer");
    expect(zoneAt(ZONES, { x: 200, y: 400 }, 2)).toBe("library");
  });

  it("is null for a drop that missed every zone", () => {
    expect(zoneAt(ZONES, { x: 1200, y: 400 }, 2)).toBeNull();
    expect(zoneAt(ZONES, null, 2)).toBeNull();
  });

  it("reads the zones in order, so the first one to cover the point wins", () => {
    const overlapping: readonly DropZone<"composer" | "library">[] = [
      { box: PANE, name: "composer" },
      { box: PANE, name: "library" },
    ];

    expect(zoneAt(overlapping, { x: 120, y: 400 }, 1)).toBe("composer");
  });

  it("skips a zone that is not on screen to take the one behind it", () => {
    const closed: readonly DropZone<"composer" | "library">[] = [
      { box: null, name: "composer" },
      { box: PANE, name: "library" },
    ];

    expect(zoneAt(closed, { x: 120, y: 400 }, 1)).toBe("library");
  });
});

describe("mediaDrop", () => {
  it("keeps pictures, video and sound, and skips everything else", () => {
    const { kept, skipped } = mediaDrop([
      "/tmp/shot.png",
      "/tmp/intro.mp4",
      "/tmp/theme.wav",
      "/tmp/Scene.tsx",
    ]);

    expect(kept.map((item) => item.mediaType)).toEqual([
      "image/png",
      "video/mp4",
      "audio/wav",
    ]);
    expect(skipped).toEqual(["/tmp/Scene.tsx"]);
  });

  it("keeps them in the order they were dropped", () => {
    const { kept } = mediaDrop(["/tmp/b.mp4", "/tmp/a.png"]);

    expect(kept.map((item) => item.name)).toEqual(["b.mp4", "a.png"]);
  });
});

describe("refusalOf", () => {
  it("says nothing when everything dropped was usable", () => {
    expect(refusalOf([], "the library")).toBeNull();
  });

  it("names the one thing that was not media", () => {
    expect(refusalOf(["/tmp/notes.md"], "the library")).toContain(
      "That is not a picture"
    );
  });

  it("counts them when several were not", () => {
    expect(refusalOf(["/a.md", "/b.txt", "/c.zip"], "the library")).toContain(
      "3 of those"
    );
  });

  it("says where they did not go, which is not always the library", () => {
    expect(refusalOf(["/tmp/notes.md"], "the message")).toContain(
      "into the message"
    );
    expect(refusalOf(["/a.md", "/b.txt"], "the message")).toContain(
      "into the message"
    );
  });
});
