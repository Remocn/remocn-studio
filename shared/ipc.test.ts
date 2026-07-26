import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { codecsFor, decodeHostFrame, decodeMethod } from "@/shared/ipc";

const TURN = {
  attachments: [],
  effort: null,
  historyId: "history-1",
  mode: "plan",
  model: null,
  projectId: "project-1",
  prompt: "make a title card",
  sessionId: null,
};

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

describe("the mode on the wire", () => {
  it("carries the mode a turn should run in", () => {
    const params = codecsFor("claude.prompt").params(TURN);

    expect(Exit.isSuccess(params) && params.value.mode).toBe("plan");
  });

  it("refuses a mode the sidecar does not know", () => {
    expect(
      Exit.isFailure(
        codecsFor("claude.prompt").params({
          ...TURN,
          mode: "bypassPermissions",
        })
      )
    ).toBe(true);
  });

  it("lets a permission answer say which mode to continue in", () => {
    const params = codecsFor("claude.permission").params({
      decision: "allow",
      id: "p1",
      mode: "acceptEdits",
    });

    expect(Exit.isSuccess(params) && params.value.mode).toBe("acceptEdits");
  });

  it("keeps the mode out of every other answer", () => {
    const params = codecsFor("claude.permission").params({
      decision: "deny",
      id: "p1",
      mode: null,
    });

    expect(Exit.isSuccess(params) && params.value.mode).toBeNull();
  });
});
