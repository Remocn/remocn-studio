import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodePreviewCommand,
  decodePreviewMessage,
  freezeCommand,
  inspectCommand,
  originOf,
  seekCommand,
  snapshotCommand,
} from "./preview";

const picked = {
  compositionId: "Main",
  reason: "main",
  source: "remocn-preview",
  total: 3,
  type: "composition",
  unmeasured: false,
};

const nothingRegistered = {
  compositionId: null,
  reason: "none",
  source: "remocn-preview",
  total: 0,
  type: "composition",
  unmeasured: false,
};

const selected = {
  element: {
    column: 7,
    component: "TitleCard",
    composition: "Main",
    file: "/Users/me/video/src/TitleCard.tsx",
    fps: 30,
    frame: 42,
    html: "<h1>Hello</h1>",
    line: 12,
    scene: { durationInFrames: 90, frame: 12, from: 30, name: "TitleCard" },
    stack: ["TitleCard (/Users/me/video/src/TitleCard.tsx:12:7)"],
  },
  rect: { height: 0.2, width: 0.5, x: 0.25, y: 0.4 },
  source: "remocn-preview",
  type: "selection",
};

const captured = {
  composition: "Main",
  frame: 42,
  rect: null,
  source: "remocn-preview",
  type: "capture",
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

  it("ignores a message with no type at all", () => {
    const { type, ...untyped } = picked;

    expect(Exit.isFailure(decodePreviewMessage(untyped))).toBe(true);
    expect(type).toBe("composition");
  });

  it("accepts a selection with everything the entry resolved", () => {
    const decoded = decodePreviewMessage(selected);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.element.line
    ).toBe(12);
  });

  it("accepts a selection whose source could not be resolved", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      element: {
        ...selected.element,
        column: null,
        component: null,
        file: null,
        line: null,
        scene: null,
        stack: [],
      },
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("refuses a selection with no rectangle to draw a marker on", () => {
    const { rect, ...withoutRect } = selected;

    expect(Exit.isFailure(decodePreviewMessage(withoutRect))).toBe(true);
    expect(rect.x).toBe(0.25);
  });

  it("refuses a selection whose file is an empty string", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      element: { ...selected.element, file: "" },
    });

    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it("accepts the answer the entry sends back when Inspect is armed", () => {
    const decoded = decodePreviewMessage({
      paused: true,
      source: "remocn-preview",
      status: "armed",
      type: "inspect",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "inspect" &&
        decoded.value.status
    ).toBe("armed");
  });

  it("accepts every reason the entry has for not arming", () => {
    for (const status of ["disarmed", "no-canvas", "no-grab"]) {
      expect(
        Exit.isSuccess(
          decodePreviewMessage({
            paused: false,
            source: "remocn-preview",
            status,
            type: "inspect",
          })
        )
      ).toBe(true);
    }
  });

  it("refuses an inspect answer with a status nobody wrote", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          paused: true,
          source: "remocn-preview",
          status: "probably-fine",
          type: "inspect",
        })
      )
    ).toBe(true);
  });

  it("accepts the answer the entry sends back when Snapshot is armed", () => {
    const decoded = decodePreviewMessage({
      paused: true,
      source: "remocn-preview",
      status: "armed",
      type: "snapshot",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "snapshot" &&
        decoded.value.status
    ).toBe("armed");
  });

  it("refuses a snapshot answer blaming grab, which it never uses", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          paused: true,
          source: "remocn-preview",
          status: "no-grab",
          type: "snapshot",
        })
      )
    ).toBe(true);
  });

  it("accepts a whole-frame capture, which carries no rectangle", () => {
    const decoded = decodePreviewMessage(captured);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "capture" &&
        decoded.value.rect
    ).toBeNull();
  });

  it("accepts a capture of the part that was dragged", () => {
    const decoded = decodePreviewMessage({
      ...captured,
      rect: { height: 0.25, width: 0.5, x: 0.25, y: 0.5 },
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "capture" &&
        decoded.value.rect?.width
    ).toBe(0.5);
  });

  it("refuses a capture of a frame that is not a whole number", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...captured, frame: 4.5 }))
    ).toBe(true);
  });

  it("refuses a capture with no composition to render", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...captured, composition: "" }))
    ).toBe(true);
  });

  it("accepts the rebuild notice that clears the markers", () => {
    expect(
      Exit.isSuccess(
        decodePreviewMessage({ source: "remocn-preview", type: "rebuilt" })
      )
    ).toBe(true);
  });
});

describe("decodePreviewCommand", () => {
  it("accepts arming and disarming inspect", () => {
    expect(Exit.isSuccess(decodePreviewCommand(inspectCommand(true)))).toBe(
      true
    );
    expect(Exit.isSuccess(decodePreviewCommand(inspectCommand(false)))).toBe(
      true
    );
  });

  it("accepts arming and disarming snapshot", () => {
    expect(Exit.isSuccess(decodePreviewCommand(snapshotCommand(true)))).toBe(
      true
    );
    expect(Exit.isSuccess(decodePreviewCommand(snapshotCommand(false)))).toBe(
      true
    );
  });

  it("keeps arming inspect and arming snapshot apart", () => {
    const decoded = decodePreviewCommand(snapshotCommand(true));

    expect(Exit.isSuccess(decoded) && decoded.value.type).toBe("snapshot");
  });

  it("accepts freezing the frame while a card is open", () => {
    expect(Exit.isSuccess(decodePreviewCommand(freezeCommand(true)))).toBe(
      true
    );
  });

  it("accepts a seek back to the frame a selection was made on", () => {
    const decoded = decodePreviewCommand(seekCommand(42));

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "seek" &&
        decoded.value.frame
    ).toBe(42);
  });

  it("refuses a fractional frame", () => {
    expect(Exit.isFailure(decodePreviewCommand(seekCommand(4.5)))).toBe(true);
  });

  it("refuses a command that does not come from the app", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({ ...inspectCommand(true), source: "elsewhere" })
      )
    ).toBe(true);
  });

  it("refuses a command the entry does not know how to obey", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({ source: "remocn-studio", type: "explode" })
      )
    ).toBe(true);
  });
});

describe("originOf", () => {
  it("reads the origin a preview serves from", () => {
    expect(originOf("http://127.0.0.1:52341")).toBe("http://127.0.0.1:52341");
  });

  it("drops the path, so only the origin is ever compared", () => {
    expect(originOf("http://127.0.0.1:52341/index.html")).toBe(
      "http://127.0.0.1:52341"
    );
  });

  it("has no origin for something that is not a url", () => {
    expect(originOf("not a url")).toBeNull();
  });
});
