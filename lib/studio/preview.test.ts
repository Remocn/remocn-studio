import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { decodePreviewMessage } from "./preview";

const picked = {
  compositionId: "Main",
  reason: "main",
  source: "remocn-preview",
  total: 3,
  unmeasured: false,
};

const nothingRegistered = {
  compositionId: null,
  reason: "none",
  source: "remocn-preview",
  total: 0,
  unmeasured: false,
};

describe("decodePreviewMessage", () => {
  it("accepts what the preview entry posts when it picked Main", () => {
    expect(Exit.isSuccess(decodePreviewMessage(picked))).toBe(true);
  });

  it("accepts what the preview entry posts when the project registers none", () => {
    expect(Exit.isSuccess(decodePreviewMessage(nothingRegistered))).toBe(true);
  });

  it("accepts a composition matched from the opened folder", () => {
    const decoded = decodePreviewMessage({
      ...picked,
      compositionId: "introducing-opus-5",
      reason: "folder",
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("accepts a first-composition fallback with unresolved metadata", () => {
    const decoded = decodePreviewMessage({
      ...picked,
      compositionId: "Intro",
      reason: "first",
      unmeasured: true,
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("ignores messages from anything but the preview", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...picked, source: "webpack" }))
    ).toBe(true);
  });

  it("ignores a pick the hint does not know how to explain", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...picked, reason: "whatever" }))
    ).toBe(true);
  });

  it("ignores a message missing a field the hint reads", () => {
    const { unmeasured, ...withoutUnmeasured } = picked;

    expect(Exit.isFailure(decodePreviewMessage(withoutUnmeasured))).toBe(true);
    expect(unmeasured).toBe(false);
  });
});
