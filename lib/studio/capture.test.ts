import { describe, expect, it } from "vitest";
import { captureBox, fitLongEdge, LONG_EDGE, stillName } from "./capture";

const FRAME = { height: 1080, width: 1920 };

describe("captureBox", () => {
  it("takes the whole frame when nothing was drawn", () => {
    expect(captureBox(null, FRAME)).toEqual({
      height: 1080,
      width: 1920,
      x: 0,
      y: 0,
    });
  });

  it("reads a rectangle that covers everything as the whole frame", () => {
    expect(captureBox({ height: 1, width: 1, x: 0, y: 0 }, FRAME)).toEqual(
      captureBox(null, FRAME)
    );
  });

  it("turns a share of the composition into its pixels", () => {
    expect(
      captureBox({ height: 0.25, width: 0.5, x: 0.25, y: 0.5 }, FRAME)
    ).toEqual({ height: 270, width: 960, x: 480, y: 540 });
  });

  it("crops the same region whatever the render resolution is", () => {
    const rect = { height: 0.25, width: 0.5, x: 0.25, y: 0.5 };

    expect(captureBox(rect, { height: 2160, width: 3840 })).toEqual({
      height: 540,
      width: 1920,
      x: 960,
      y: 1080,
    });
  });

  it("clamps a rectangle that runs past the frame", () => {
    expect(
      captureBox({ height: 4, width: 4, x: 0.75, y: 0.75 }, FRAME)
    ).toEqual({ height: 270, width: 480, x: 1440, y: 810 });
  });

  it("never hands back a box with no pixels in it", () => {
    const box = captureBox({ height: 0, width: 0, x: 1, y: 1 }, FRAME);

    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeLessThan(FRAME.width);
    expect(box.y).toBeLessThan(FRAME.height);
  });
});

describe("fitLongEdge", () => {
  it("leaves a frame that is already small enough alone", () => {
    expect(fitLongEdge({ height: 720, width: 1280 })).toEqual({
      height: 720,
      width: 1280,
    });
  });

  it("caps the long edge and keeps the aspect", () => {
    expect(fitLongEdge(FRAME)).toEqual({ height: 882, width: LONG_EDGE });
  });

  it("caps the long edge of a portrait frame too", () => {
    expect(fitLongEdge({ height: 1920, width: 1080 })).toEqual({
      height: LONG_EDGE,
      width: 882,
    });
  });

  it("keeps a sliver of a crop at least one pixel wide", () => {
    expect(fitLongEdge({ height: 4000, width: 1 })).toEqual({
      height: LONG_EDGE,
      width: 1,
    });
  });
});

describe("stillName", () => {
  it("names a snapshot after its composition and frame", () => {
    expect(stillName("Main", 42)).toBe("Main-frame-42.png");
  });

  it("keeps three snapshots of one message apart", () => {
    expect(new Set([stillName("Main", 0), stillName("Main", 1)]).size).toBe(2);
  });

  it("takes the path separators out of a composition id", () => {
    expect(stillName("scenes/intro", 7)).toBe("scenes-intro-frame-7.png");
  });

  it("still has a name when the composition id is all punctuation", () => {
    expect(stillName("///", 3)).toBe("still-frame-3.png");
  });
});
