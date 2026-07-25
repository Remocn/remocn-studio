import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { decodePreviewMessage } from "./preview";

const picked = {
  compositionId: "Main",
  isFallback: false,
  source: "remocn-preview",
  total: 3,
  unmeasured: false,
};

const nothingRegistered = {
  compositionId: null,
  isFallback: false,
  source: "remocn-preview",
  total: 0,
  unmeasured: false,
};

describe("decodePreviewMessage", () => {
  it("accepts what the preview entry posts when it picked a composition", () => {
    const decoded = decodePreviewMessage(picked);

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("accepts what the preview entry posts when the project registers none", () => {
    const decoded = decodePreviewMessage(nothingRegistered);

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("accepts a fallback pick with unresolved metadata", () => {
    const decoded = decodePreviewMessage({
      ...picked,
      compositionId: "Intro",
      isFallback: true,
      unmeasured: true,
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("ignores messages from anything but the preview", () => {
    const decoded = decodePreviewMessage({ ...picked, source: "webpack" });

    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it("ignores a message missing a field the hint reads", () => {
    const { unmeasured, ...withoutUnmeasured } = picked;

    expect(Exit.isFailure(decodePreviewMessage(withoutUnmeasured))).toBe(true);
    expect(unmeasured).toBe(false);
  });
});
