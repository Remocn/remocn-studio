import { describe, expect, it } from "bun:test";
import { wordFailure } from "@/lib/studio/failure-text";

const FALLBACK = "Something went wrong.";

describe("wordFailure", () => {
  it("keeps a message that is already a sentence, with nothing behind it", () => {
    expect(wordFailure("the sidecar is not running", FALLBACK)).toEqual({
      details: null,
      sentence: "the sidecar is not running",
    });
  });

  it("drops the Error: prefix", () => {
    expect(wordFailure("Error: the folder is gone", FALLBACK).sentence).toBe(
      "the folder is gone"
    );
  });

  it("puts a stack behind Details and keeps its first line", () => {
    const raw = "the render stopped\n    at frame (render.ts:1:1)";
    expect(wordFailure(raw, FALLBACK)).toEqual({
      details: raw,
      sentence: "the render stopped",
    });
  });

  it("never shows JSON as the sentence", () => {
    const raw = '{"code":42,"reason":"bad"}';
    expect(wordFailure(raw, FALLBACK)).toEqual({
      details: raw,
      sentence: FALLBACK,
    });
  });

  it("never shows a bare protocol token as the sentence", () => {
    expect(wordFailure("cancelled", FALLBACK)).toEqual({
      details: "cancelled",
      sentence: FALLBACK,
    });
  });

  it("keeps a JavaScript error behind Details rather than as the sentence", () => {
    const raw = "TypeError: Cannot read properties of undefined (reading 'x')";
    expect(wordFailure(raw, FALLBACK)).toEqual({
      details: raw,
      sentence: FALLBACK,
    });
  });

  it("keeps an engine message behind Details even without its error name", () => {
    const raw = "Error: undefined is not an object (evaluating 'scene.width')";
    expect(wordFailure(raw, FALLBACK)).toEqual({
      details: raw,
      sentence: FALLBACK,
    });
    expect(wordFailure("render is not a function", FALLBACK).sentence).toBe(
      FALLBACK
    );
  });

  it("still words a named error it recognises", () => {
    const raw = "SystemError: ENOENT: no such file or directory";
    expect(wordFailure(raw, FALLBACK).sentence).toBe(
      "A file it needed could not be found."
    );
  });

  it("words a missing file", () => {
    const raw = "ENOENT: no such file or directory, open '/tmp/x.mp4'";
    expect(wordFailure(raw, FALLBACK)).toEqual({
      details: raw,
      sentence: "A file it needed could not be found.",
    });
  });

  it("falls back when there is nothing to say", () => {
    expect(wordFailure("  ", FALLBACK)).toEqual({
      details: null,
      sentence: FALLBACK,
    });
    expect(wordFailure(null, FALLBACK).sentence).toBe(FALLBACK);
  });

  it("words a refused permission without naming macOS", () => {
    expect(
      wordFailure("EACCES: permission denied, open '/srv/x'", FALLBACK).sentence
    ).toBe("The system did not allow the studio to use a file there.");
  });
});
