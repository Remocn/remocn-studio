import { describe, expect, it } from "bun:test";
import { Exit } from "effect";
import { codecsFor, decodeHostFrame, decodeMethod } from "@/shared/ipc";

const REPORT = {
  detail: "This project declares remotion 4.0.481.",
  id: "remotion",
  state: "warn",
  title: "Text and type editing needs Remotion 4.0.513 or newer",
};

const TURN = {
  attachments: [],
  effort: null,
  historyId: "history-1",
  mode: "plan",
  model: null,
  projectId: "project-1",
  prompt: "make a title card",
  sessionId: null,
  videoId: "video-1",
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

describe("the element selections on the wire", () => {
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

  it("carries the component that owns each requested change", () => {
    const owned = {
      ...SELECTION,
      tuningChanges: [
        {
          from: 12,
          owner: {
            component: "WordPush",
            file: "components/WordPush.tsx",
            line: 243,
            name: "Pushed line",
          },
          path: "amount",
          to: 20,
        },
      ],
    };

    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [owned],
    });

    expect(Exit.isSuccess(params) && params.value.elements[0]).toEqual(owned);
  });

  it("reads a stored change that predates the owner", () => {
    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [
        { ...SELECTION, tuningChanges: [{ from: 12, path: "amount", to: 20 }] },
      ],
    });

    expect(
      Exit.isSuccess(params) && params.value.elements[0].tuningChanges
    ).toEqual([{ from: 12, path: "amount", to: 20 }]);
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

describe("the environment fixes on the wire", () => {
  it("carries the packages and the version an upgrade would pin", () => {
    const fix = {
      packages: ["@remotion/cli", "remotion"],
      type: "upgrade",
      version: "4.0.520",
    };

    const report = codecsFor("project.check").result({
      checks: [{ ...REPORT, fix }],
    });

    expect(Exit.isSuccess(report) && report.value.checks[0].fix).toEqual(fix);
  });

  it("still reads a row whose fix is one of the older four", () => {
    const report = codecsFor("project.check").result({
      checks: [{ ...REPORT, fix: { type: "install" } }],
    });

    expect(Exit.isSuccess(report) && report.value.checks[0].fix).toEqual({
      type: "install",
    });
  });

  it("takes an upgrade request naming what to pin", () => {
    const params = codecsFor("project.upgrade").params({
      packages: ["remotion"],
      projectId: "project-1",
      version: "4.0.520",
    });

    expect(Exit.isSuccess(params) && params.value.packages).toEqual([
      "remotion",
    ]);
  });
});

describe("a sampled tuning change", () => {
  const CHANGE = { from: 12, path: "amount", to: 20 };

  it("carries the flag when the pane took the value off the curve", () => {
    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [
        { ...SELECTION, tuningChanges: [{ ...CHANGE, sampled: true }] },
      ],
    });

    expect(
      Exit.isSuccess(params) && params.value.elements[0].tuningChanges
    ).toEqual([{ ...CHANGE, sampled: true }]);
  });

  it("reads a change written before the flag existed", () => {
    const params = codecsFor("agent.prompt").params({
      ...TURN,
      elements: [{ ...SELECTION, tuningChanges: [CHANGE] }],
    });

    expect(
      Exit.isSuccess(params) && params.value.elements[0].tuningChanges
    ).toEqual([CHANGE]);
  });
});

describe("shader IPC", () => {
  const target = {
    contract: 1,
    durationInFrames: 150,
    fps: 24,
    from: 0,
    generation: "build-1",
    label: "Whole video",
    projectId: "project-1",
    sceneId: null,
    slotId: "root-shaders",
    sourceRevision: "hash",
    video: "intro",
  };
  it("requires scoped live target identity on direct insertion", () => {
    const request = {
      objectId: "shader-one",
      operationId: "insert-one",
      slug: "shader-mesh-gradient",
      target,
    };
    expect(Exit.isSuccess(codecsFor("shader.insert").params(request))).toBe(
      true
    );
    expect(
      Exit.isFailure(
        codecsFor("shader.insert").params({
          ...request,
          target: { ...target, generation: null },
        })
      )
    ).toBe(true);
    expect(
      Exit.isFailure(
        codecsFor("shader.insert").params({
          ...request,
          target: { ...target, fps: 0 },
        })
      )
    ).toBe(true);
    expect(
      Exit.isFailure(
        codecsFor("shader.insert").params({
          ...request,
          target: { ...target, video: "../outside" },
        })
      )
    ).toBe(true);
  });
  it("decodes capability queries, progress and restart lookup", () => {
    expect(
      Exit.isSuccess(
        codecsFor("shader.targets").params({
          generation: null,
          projectId: "project-1",
          video: "intro",
        })
      )
    ).toBe(true);
    expect(
      Exit.isSuccess(
        codecsFor("shader.insert").stream({
          message: "Waiting for the scene",
          operationId: "insert-one",
          phase: "capability",
          projectId: "project-1",
          video: "intro",
        })
      )
    ).toBe(true);
    expect(
      Exit.isFailure(
        codecsFor("shader.insert").stream({
          message: "Done",
          operationId: "insert-one",
          phase: "rendered",
          projectId: "project-1",
          video: "intro",
        })
      )
    ).toBe(true);
    expect(
      Exit.isSuccess(
        codecsFor("shader.insertionStatus").result({ state: "unknown" })
      )
    ).toBe(true);
  });
});

it("decodes explicit shader preparation and refuses incomplete revisions and statuses", () => {
  expect(
    Exit.isSuccess(
      codecsFor("agent.prompt").params({
        ...TURN,
        shaderPreparation: { revision: "source-revision" },
      })
    )
  ).toBe(true);
  expect(
    Exit.isFailure(
      codecsFor("agent.prompt").params({
        ...TURN,
        shaderPreparation: { revision: "" },
      })
    )
  ).toBe(true);
  expect(
    Exit.isSuccess(
      codecsFor("shader.targets").result({
        adaptation: false,
        preparation: {
          historyId: "chat",
          message: "Waiting for preview",
          phase: "activating",
        },
        preparationRevision: "source-revision",
        reason: "Prepare scene slots",
        targets: [],
      })
    )
  ).toBe(true);
  expect(
    Exit.isFailure(
      codecsFor("shader.targets").result({
        adaptation: false,
        preparation: { message: "Ready", phase: "ready" },
        reason: null,
        targets: [],
      })
    )
  ).toBe(true);
});
