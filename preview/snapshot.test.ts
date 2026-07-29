import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD, isDrag, normalisedRect, videoBox } from "./snapshot";

const CANVAS = { height: 360, left: 100, top: 50, width: 640 };

describe("isDrag", () => {
  it("treats a shaky hand as a click", () => {
    expect(isDrag({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(false);
  });

  it("treats a pointer that never moved as a click", () => {
    expect(isDrag({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false);
  });

  it("takes a rectangle once either axis clears the threshold", () => {
    expect(isDrag({ x: 10, y: 10 }, { x: 10 + DRAG_THRESHOLD, y: 10 })).toBe(
      true
    );
    expect(isDrag({ x: 10, y: 10 }, { x: 10, y: 10 + DRAG_THRESHOLD })).toBe(
      true
    );
  });

  it("counts a drag that went up and to the left", () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 40, y: 30 })).toBe(true);
  });
});

describe("videoBox", () => {
  it("is the whole canvas when the aspects already agree", () => {
    expect(videoBox(CANVAS, 1920, 1080)).toEqual(CANVAS);
  });

  it("letterboxes a composition taller than its canvas", () => {
    expect(videoBox(CANVAS, 1080, 1080)).toEqual({
      height: 360,
      left: 240,
      top: 50,
      width: 360,
    });
  });

  it("pillarboxes a composition wider than its canvas", () => {
    expect(
      videoBox({ height: 400, left: 0, top: 0, width: 640 }, 1920, 1080)
    ).toEqual({ height: 360, left: 0, top: 20, width: 640 });
  });

  it("gives up on a canvas with no area rather than dividing by zero", () => {
    const empty = { height: 0, left: 0, top: 0, width: 0 };
    expect(videoBox(empty, 1920, 1080)).toEqual(empty);
  });

  it("gives up on a composition that has not been measured", () => {
    expect(videoBox(CANVAS, 0, 0)).toEqual(CANVAS);
  });
});

describe("normalisedRect", () => {
  it("reads a rectangle as a share of the composition, not of the window", () => {
    expect(
      normalisedRect({ x: 260, y: 140 }, { x: 420, y: 230 }, CANVAS)
    ).toEqual({ height: 0.25, width: 0.25, x: 0.25, y: 0.25 });
  });

  it("reads the same region off a preview of a different size", () => {
    const small = normalisedRect(
      { x: 260, y: 140 },
      { x: 420, y: 230 },
      CANVAS
    );
    const large = normalisedRect(
      { x: 320, y: 180 },
      { x: 640, y: 360 },
      { height: 720, left: 0, top: 0, width: 1280 }
    );

    expect(large).toEqual(small);
  });

  it("does not care which corner the drag started from", () => {
    expect(
      normalisedRect({ x: 420, y: 230 }, { x: 260, y: 140 }, CANVAS)
    ).toEqual(normalisedRect({ x: 260, y: 140 }, { x: 420, y: 230 }, CANVAS));
  });

  it("clamps a drag that ran off the frame", () => {
    expect(
      normalisedRect({ x: -400, y: -400 }, { x: 4000, y: 4000 }, CANVAS)
    ).toEqual({ height: 1, width: 1, x: 0, y: 0 });
  });

  it("has no rectangle when the drag never entered the frame", () => {
    expect(normalisedRect({ x: 0, y: 0 }, { x: 40, y: 20 }, CANVAS)).toBeNull();
  });

  it("has no rectangle without a frame to measure against", () => {
    expect(
      normalisedRect(
        { x: 10, y: 10 },
        { x: 40, y: 40 },
        { height: 0, left: 0, top: 0, width: 0 }
      )
    ).toBeNull();
  });
});
