// @vitest-environment node

import { describe, expect, it } from "vitest";
import { byteRange, UNSATISFIABLE } from "./range";

const SIZE = 1000;

describe("byteRange", () => {
  it("serves the whole file when nothing was asked for", () => {
    expect(byteRange(undefined, SIZE)).toBeNull();
  });

  it("answers the probe a webview opens a video with", () => {
    expect(byteRange("bytes=0-1", SIZE)).toEqual({ end: 1, start: 0 });
  });

  it("runs an open range to the last byte", () => {
    expect(byteRange("bytes=500-", SIZE)).toEqual({ end: 999, start: 500 });
  });

  it("clamps an end past the file to the last byte", () => {
    expect(byteRange("bytes=900-5000", SIZE)).toEqual({ end: 999, start: 900 });
  });

  it("reads a suffix from the end", () => {
    expect(byteRange("bytes=-200", SIZE)).toEqual({ end: 999, start: 800 });
  });

  it("gives the whole file to a suffix longer than it", () => {
    expect(byteRange("bytes=-5000", SIZE)).toEqual({ end: 999, start: 0 });
  });

  it("tolerates the whitespace the header allows", () => {
    expect(byteRange(" Bytes = 0 - 1 ", SIZE)).toEqual({ end: 1, start: 0 });
  });

  it("refuses a start beyond the file", () => {
    expect(byteRange("bytes=1000-1200", SIZE)).toBe(UNSATISFIABLE);
  });

  it("refuses an end before its start", () => {
    expect(byteRange("bytes=500-400", SIZE)).toBe(UNSATISFIABLE);
  });

  it("refuses a zero-length suffix", () => {
    expect(byteRange("bytes=-0", SIZE)).toBe(UNSATISFIABLE);
  });

  it("refuses any range into an empty file", () => {
    expect(byteRange("bytes=0-", 0)).toBe(UNSATISFIABLE);
    expect(byteRange("bytes=-10", 0)).toBe(UNSATISFIABLE);
  });

  it("ignores a header it cannot read rather than failing it", () => {
    expect(byteRange("items=0-1", SIZE)).toBeNull();
    expect(byteRange("bytes=abc-1", SIZE)).toBeNull();
    expect(byteRange("bytes=0-xyz", SIZE)).toBeNull();
    expect(byteRange("bytes=-", SIZE)).toBeNull();
    expect(byteRange("bytes=0", SIZE)).toBeNull();
    expect(byteRange("", SIZE)).toBeNull();
  });

  it("serves the whole file for a multi-range ask", () => {
    expect(byteRange("bytes=0-99,200-299", SIZE)).toBeNull();
  });
});
