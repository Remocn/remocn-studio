import { describe, expect, it } from "vitest";
import { boxOf, cardPlacement } from "./card";

const STAGE = { height: 540, width: 960 };
const CARD = { height: 140, width: 280 };
const GAP = 8;

describe("boxOf", () => {
  it("turns a rectangle normalised to the preview into pixels", () => {
    expect(boxOf({ height: 0.2, width: 0.5, x: 0.25, y: 0.4 }, STAGE)).toEqual({
      height: 108,
      width: 480,
      x: 240,
      y: 216,
    });
  });

  it("keeps a marker on its element when the window resizes", () => {
    const rect = { height: 0.2, width: 0.5, x: 0.25, y: 0.4 };
    const wide = boxOf(rect, { height: 1080, width: 1920 });

    expect(wide.x / 1920).toBeCloseTo(boxOf(rect, STAGE).x / 960);
  });
});

describe("cardPlacement", () => {
  it("opens under the element, aligned to its left edge", () => {
    expect(
      cardPlacement(
        { height: 40, width: 200, x: 100, y: 100 },
        STAGE,
        CARD,
        GAP
      )
    ).toEqual({ x: 100, y: 148 });
  });

  it("flips above when there is no room below", () => {
    expect(
      cardPlacement(
        { height: 40, width: 200, x: 100, y: 460 },
        STAGE,
        CARD,
        GAP
      )
    ).toEqual({ x: 100, y: 312 });
  });

  it("flips to the element's right edge when there is no room to the right", () => {
    expect(
      cardPlacement(
        { height: 40, width: 140, x: 800, y: 100 },
        STAGE,
        CARD,
        GAP
      )
    ).toEqual({ x: 660, y: 148 });
  });

  it("flips on both axes at the far corner", () => {
    expect(
      cardPlacement(
        { height: 40, width: 140, x: 800, y: 460 },
        STAGE,
        CARD,
        GAP
      )
    ).toEqual({ x: 660, y: 312 });
  });

  it("never runs off the right edge of the stage", () => {
    expect(
      cardPlacement({ height: 40, width: 60, x: 900, y: 100 }, STAGE, CARD, GAP)
        .x
    ).toBe(680);
  });

  it("stays on the stage when neither side of the element has room", () => {
    expect(
      cardPlacement(
        { height: 40, width: 200, x: 100, y: 30 },
        { height: 160, width: 960 },
        CARD,
        GAP
      ).y
    ).toBe(0);
  });

  it("pins to the corner when the card is larger than the stage", () => {
    expect(
      cardPlacement(
        { height: 40, width: 200, x: 100, y: 100 },
        { height: 100, width: 200 },
        CARD,
        GAP
      )
    ).toEqual({ x: 0, y: 0 });
  });
});
