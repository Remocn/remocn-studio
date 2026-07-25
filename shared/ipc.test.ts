import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { decodeHostFrame, decodeMethod } from "@/shared/ipc";

function decoded(line: string) {
  const frame = decodeHostFrame(line);
  return Exit.isSuccess(frame) ? frame.value : null;
}

describe("decodeHostFrame", () => {
  it("reads a request", () => {
    expect(
      decoded(
        '{"type":"request","id":"a","method":"sidecar.info","params":null}'
      )
    ).toEqual({
      id: "a",
      method: "sidecar.info",
      params: null,
      type: "request",
    });
  });

  it("reads a cancel", () => {
    expect(decoded('{"type":"cancel","id":"a"}')).toEqual({
      id: "a",
      type: "cancel",
    });
  });

  it("keeps an unknown method so the host can answer it", () => {
    expect(
      decoded('{"type":"request","id":"a","method":"nope","params":null}')
    ).toMatchObject({ method: "nope" });
  });

  it.each([
    ["not json", "not json"],
    ["a bare value", "42"],
    ["null", "null"],
    ["a frame with no id", '{"type":"request","method":"sidecar.info"}'],
    ["a frame with an empty id", '{"type":"request","id":"","method":"x"}'],
    ["a request with no method", '{"type":"request","id":"a"}'],
    ["an unknown type", '{"type":"shout","id":"a"}'],
  ])("refuses %s", (_label, line) => {
    expect(Exit.isFailure(decodeHostFrame(line))).toBe(true);
  });
});

describe("decodeMethod", () => {
  it("accepts a method the sidecar has", () => {
    expect(Exit.isSuccess(decodeMethod("sidecar.emit"))).toBe(true);
  });

  it("refuses anything else", () => {
    expect(Exit.isFailure(decodeMethod("sidecar.nope"))).toBe(true);
  });
});
