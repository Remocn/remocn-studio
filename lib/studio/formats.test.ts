import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMAT,
  formatById,
  sizeOf,
  VIDEO_FORMATS,
} from "@/lib/studio/formats";

const RATIO = /^(\d+):(\d+)$/;

describe("VIDEO_FORMATS", () => {
  it("gives every option a distinct id", () => {
    const ids = new Set(VIDEO_FORMATS.map((format) => format.id));

    expect(ids.size).toBe(VIDEO_FORMATS.length);
  });

  it.each(VIDEO_FORMATS)(
    "sizes $id as the $label its label promises",
    (format) => {
      const parts = RATIO.exec(format.label);

      expect(parts).not.toBeNull();
      expect(format.width / format.height).toBeCloseTo(
        Number(parts?.[1]) / Number(parts?.[2]),
        5
      );
    }
  );

  it("offers the ratios the export presets target", () => {
    expect(VIDEO_FORMATS.map((format) => format.label)).toEqual([
      "16:9",
      "9:16",
      "1:1",
      "4:5",
    ]);
  });
});

describe("formatById", () => {
  it("finds the option a radio group reports", () => {
    expect(formatById("vertical")).toBe(VIDEO_FORMATS[1]);
  });

  it("falls back rather than leaving a project without a size", () => {
    expect(formatById("cinema")).toBe(DEFAULT_FORMAT);
  });
});

describe("sizeOf", () => {
  it("carries only what crosses the wire", () => {
    expect(sizeOf(DEFAULT_FORMAT)).toEqual({ height: 1080, width: 1920 });
  });
});
