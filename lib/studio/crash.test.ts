import { describe, expect, it } from "bun:test";
import { isStrayAbort } from "@/lib/studio/crash";

function mediaParserAbort(message: string): Error {
  const error = new Error(message);
  error.name = "MediaParserAbortError";
  return error;
}

describe("isStrayAbort", () => {
  it("drops what a failed conversion's in-flight frames throw after it", () => {
    expect(isStrayAbort(mediaParserAbort("Aborted"))).toBe(true);
    expect(isStrayAbort(mediaParserAbort("Conversion aborted by user"))).toBe(
      true
    );
  });

  it("keeps every other error", () => {
    expect(isStrayAbort(new Error("Aborted"))).toBe(false);
    expect(isStrayAbort(new DOMException("Aborted", "AbortError"))).toBe(false);
    expect(isStrayAbort(new TypeError("x is undefined"))).toBe(false);
  });

  it("keeps a rejection that is not an error at all", () => {
    expect(isStrayAbort("MediaParserAbortError")).toBe(false);
    expect(isStrayAbort({ name: "MediaParserAbortError" })).toBe(false);
    expect(isStrayAbort(undefined)).toBe(false);
  });
});
