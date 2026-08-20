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
    const params = codecsFor("agent.prompt").params(TURN);

    expect(Exit.isSuccess(params) && params.value.mode).toBe("plan");
  });

  it("refuses a mode the sidecar does not know", () => {
    expect(
      Exit.isFailure(
        codecsFor("agent.prompt").params({
          ...TURN,
          mode: "bypassPermissions",
        })
      )
    ).toBe(true);
  });

  it("lets a permission answer say which mode to continue in", () => {
    const params = codecsFor("agent.permission").params({
      decision: "allow",
      id: "p1",
      mode: "acceptEdits",
    });

    expect(Exit.isSuccess(params) && params.value.mode).toBe("acceptEdits");
  });

  it("keeps the mode out of every other answer", () => {
    const params = codecsFor("agent.permission").params({
      decision: "deny",
      id: "p1",
      mode: null,
    });

    expect(Exit.isSuccess(params) && params.value.mode).toBeNull();
  });
});

describe("source asset answers", () => {
  it("carries an uploaded file chosen for a pending source ask", () => {
    const params = codecsFor("agent.source").params({
      action: "uploaded",
      file: "/Users/me/logo.svg",
      id: "source-1",
    });

    expect(Exit.isSuccess(params) && params.value.file).toBe(
      "/Users/me/logo.svg"
    );
  });
});

describe("the element selections on the wire", () => {
  const SELECTION = {
    column: 7,
    component: "TitleCard",
    composition: "Main",
    file: "/Users/me/video/src/TitleCard.tsx",
    fps: 30,
    frame: 42,
    html: "<h1>Hello</h1>",
    line: 12,
    scene: {
      durationInFrames: 90,
      frame: 12,
      from: 30,
      name: "TitleCard",
    },
    stack: ["TitleCard (/Users/me/video/src/TitleCard.tsx:12:7)"],
  };

  it("carries what the preview resolved", () => {
    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [SELECTION],
    });

    expect(Exit.isSuccess(params) && params.value.elements[0]).toEqual(
      SELECTION
    );
  });

  it("carries a selection whose source could not be resolved", () => {
    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [
        { ...SELECTION, column: null, file: null, line: null, stack: [] },
      ],
    });

    expect(Exit.isSuccess(params) && params.value.elements[0].file).toBeNull();
  });

  it("reads a turn that predates the feature as having none", () => {
    const params = codecsFor("agent.prompt").params(TURN);

    expect(Exit.isSuccess(params) && params.value.elements).toEqual([]);
  });

  it("reads a stored user block that predates the feature", () => {
    const entries = codecsFor("history.blocks").result([
      { attachments: [], id: "block-0", kind: "user", text: "hello" },
    ]);

    expect(
      Exit.isSuccess(entries) &&
        entries.value[0].kind === "user" &&
        entries.value[0].elements
    ).toEqual([]);
  });

  it("reads a stored user block that carries selections", () => {
    const entries = codecsFor("history.blocks").result([
      {
        attachments: [],
        elements: [SELECTION],
        id: "block-0",
        kind: "user",
        text: "make [Element #1] bigger",
      },
    ]);

    expect(
      Exit.isSuccess(entries) &&
        entries.value[0].kind === "user" &&
        entries.value[0].elements
    ).toEqual([SELECTION]);
  });
});
