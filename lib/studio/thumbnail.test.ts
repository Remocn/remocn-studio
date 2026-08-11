import { describe, expect, it } from "vitest";
import {
  firstFrameAt,
  peaksFrom,
  THUMBNAIL_EDGE,
  thumbnailSize,
} from "@/lib/studio/thumbnail";

describe("thumbnailSize", () => {
  it("scales a 4K frame down to the long edge, keeping its shape", () => {
    expect(thumbnailSize(3840, 2160)).toEqual({ height: 360, width: 640 });
  });

  it("measures a tall frame by its own long edge", () => {
    expect(thumbnailSize(1080, 1920)).toEqual({ height: 640, width: 360 });
  });

  it("never scales a small frame up", () => {
    expect(thumbnailSize(320, 180)).toEqual({ height: 180, width: 320 });
    expect(thumbnailSize(THUMBNAIL_EDGE, THUMBNAIL_EDGE)).toEqual({
      height: THUMBNAIL_EDGE,
      width: THUMBNAIL_EDGE,
    });
  });

  it("keeps a sliver at one pixel rather than rounding it away", () => {
    expect(thumbnailSize(4000, 1).height).toBe(1);
  });

  it("answers zero for a video that reported no picture", () => {
    expect(thumbnailSize(0, 0)).toEqual({ height: 0, width: 0 });
    expect(thumbnailSize(Number.NaN, Number.NaN)).toEqual({
      height: 0,
      width: 0,
    });
  });
});

describe("peaksFrom", () => {
  it("gives one bar per slice, loudest sample wins", () => {
    expect(peaksFrom([0, 1, 0.2, 0.1], 2)).toEqual([1, 0.2]);
  });

  it("normalises, so a quiet recording still fills the tile", () => {
    expect(peaksFrom([0.1, 0.05, 0.2, 0.02], 2)).toEqual([0.5, 1]);
  });

  it("reads a negative swing as loudly as a positive one", () => {
    expect(peaksFrom([-1, 0.5], 2)).toEqual([1, 0.5]);
  });

  it("leaves silence flat rather than dividing by nothing", () => {
    expect(peaksFrom([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });

  it("still fills every bar when there are fewer samples than bars", () => {
    expect(peaksFrom([1, 0.5], 4)).toHaveLength(4);
  });

  it("has nothing to draw for no samples or no bars", () => {
    expect(peaksFrom([], 8)).toEqual([]);
    expect(peaksFrom([1, 2], 0)).toEqual([]);
  });
});

describe("firstFrameAt", () => {
  it("lands just inside the video rather than on frame zero", () => {
    expect(firstFrameAt(30)).toBe(0.1);
  });

  it("halves a clip too short to seek a tenth of a second into", () => {
    expect(firstFrameAt(0.04)).toBe(0.02);
  });

  it("falls back when the duration is not known yet", () => {
    expect(firstFrameAt(Number.NaN)).toBe(0.1);
    expect(firstFrameAt(Number.POSITIVE_INFINITY)).toBe(0.1);
    expect(firstFrameAt(0)).toBe(0.1);
  });
});
