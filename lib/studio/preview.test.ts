import { describe, expect, it } from "bun:test";
import { Exit } from "effect";
import { PLAYBACK_RATES as RUNTIME_RATES } from "@/preview/playback-rate";
import {
  decodePreviewCommand,
  decodePreviewMessage,
  hideCommand,
  inspectCommand,
  managedSelector,
  PLAYBACK_RATES,
  pauseCommand,
  replayCommand,
  seekCommand,
  snapshotCommand,
  tuneResetCommand,
  tuneSetCommand,
  tuningStatusesCommand,
  unhideCommand,
} from "./preview";

const picked = {
  compositionId: "Main",
  compositions: ["Main", "Intro", "Outro"],
  reason: "main",
  source: "remocn-preview",
  total: 3,
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
  repeat: false,
  source: "remocn-preview",
  tuning: [],
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

  // The page carries the project's pictures and the base to load them from,
  // as it carries the loaded font families: only the page knows either. A page
  // built before this shipped sends neither, and the picker then offers what
  // it can, which is the value the element already holds.
  it("takes the project's static pictures, or none at all", () => {
    const withAssets = decodePreviewMessage({
      ...selected,
      assetBase: "http://127.0.0.1:5173/static-abc/",
      assets: ["bg.png", "library/logo.png"],
    });
    const without = decodePreviewMessage(selected);

    expect(
      Exit.isSuccess(withAssets) &&
        withAssets.value.type === "selection" &&
        withAssets.value.assets
    ).toEqual(["bg.png", "library/logo.png"]);
    expect(
      Exit.isSuccess(without) &&
        without.value.type === "selection" &&
        without.value.assetBase
    ).toBeNull();
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
    for (const status of ["disarmed", "no-canvas"]) {
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

  it("refuses a snapshot answer with a status Snapshot never sends", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          paused: true,
          source: "remocn-preview",
          status: "no-surface",
          type: "snapshot",
        })
      )
    ).toBe(true);
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

  it("refuses a playhead at a fractional frame", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          frame: 4.5,
          playing: false,
          source: "remocn-preview",
          type: "playhead",
        })
      )
    ).toBe(true);
  });

  // Everything the codemod needs to find the call site rides with the pick:
  // the coordinate Remotion recorded, the schema keys a status is asked for,
  // and the composition's own numbers.
  it("carries the call site, the keys and the video config on a link", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [
        {
          componentName: "<Interactive.H1>",
          fields: [],
          identity: "remotion.H1",
          instanceId: '[data-design-id="headline"]',
          instances: 1,
          keys: ["style.fontSize"],
          name: "Headline",
          ordinal: 1,
          origin: {
            column: 7,
            file: "/Users/me/video/src/TitleCard.tsx",
            line: 24,
          },
          schema: { "style.fontSize": { default: 16, type: "number" } },
          targetId: "anchor::H1",
          where: null,
        },
      ],
      video: { durationInFrames: 300, fps: 30, height: 1080, width: 1920 },
    });

    const link =
      Exit.isSuccess(decoded) && decoded.value.type === "selection"
        ? decoded.value.tuning[0]
        : null;

    expect(link?.origin).toEqual({
      column: 7,
      file: "/Users/me/video/src/TitleCard.tsx",
      line: 24,
    });
    expect(link?.identity).toBe("remotion.H1");
    expect(link?.keys).toEqual(["style.fontSize"]);
    expect(link?.schema).toEqual({
      "style.fontSize": { default: 16, type: "number" },
    });
    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.video?.fps
    ).toBe(30);
  });

  // A page from an older build sends none of it, and the pane still opens —
  // only writing is lost.
  it("takes a link with no call site, no keys and no video at all", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [
        {
          componentName: "<Interactive.H1>",
          fields: [],
          targetId: "anchor::H1",
        },
      ],
    });

    const link =
      Exit.isSuccess(decoded) && decoded.value.type === "selection"
        ? decoded.value.tuning[0]
        : null;

    expect(link?.origin).toBeNull();
    expect(link?.identity).toBeNull();
    expect(link?.keys).toEqual([]);
    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.video
    ).toBeNull();
  });

  it("carries the element's own timed window on the selection", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      window: { from: 408, until: 424 },
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.window
    ).toEqual({ from: 408, until: 424 });
  });

  it("reads a selection from an older build as having no window", () => {
    const decoded = decodePreviewMessage(selected);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.window
    ).toBeNull();
  });

  it("carries the element's own text and the families the page loaded", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      fonts: ["Geist", "Inter"],
      text: "Ship it",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" && {
          fonts: decoded.value.fonts,
          text: decoded.value.text,
        }
    ).toEqual({ fonts: ["Geist", "Inter"], text: "Ship it" });
  });

  it("reads a selection from an older build as having neither", () => {
    const decoded = decodePreviewMessage(selected);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" && {
          fonts: decoded.value.fonts,
          text: decoded.value.text,
        }
    ).toEqual({ fonts: [], text: null });
  });

  it("refuses a scene without a name or at a fractional frame", () => {
    for (const scene of [
      { duration: 90, from: 0, id: "a", name: "" },
      { duration: 90, from: 0.5, id: "a", name: "Intro" },
    ]) {
      expect(
        Exit.isSuccess(
          decodePreviewMessage({
            compositionId: "intro",
            scenes: [scene],
            source: "remocn-preview",
            type: "scenes",
          })
        )
      ).toBe(false);
    }
  });

  it("refuses a mounted object with no id", () => {
    expect(
      Exit.isSuccess(
        decodePreviewMessage({
          ids: [""],
          source: "remocn-preview",
          type: "studio.present",
        })
      )
    ).toBe(false);
  });

  it("accepts the rebuild notice that clears the markers", () => {
    expect(
      Exit.isSuccess(
        decodePreviewMessage({ source: "remocn-preview", type: "rebuilt" })
      )
    ).toBe(true);
  });

  it("accepts the acknowledgement for an interactive change", () => {
    const decoded = decodePreviewMessage({
      error: null,
      ok: true,
      requestId: "tune-1",
      source: "remocn-preview",
      type: "tune.result",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "tune.result" &&
        decoded.value.ok
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

  // Hover is never suppressed now, so nothing sends a freeze and the command
  // is gone: with the pane beside the frame rather than over it, the highlight
  // is what shows the next thing to pick.
  it("no longer knows how to freeze the frame", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({
          frozen: true,
          type: "freeze",
        })
      )
    ).toBe(true);
  });

  it("offers the speeds the runtime applies", () => {
    expect([...PLAYBACK_RATES]).toEqual([...RUNTIME_RATES]);
  });

  it("accepts the speeds the panel offers and nothing else", () => {
    const decodes = (rate: number) =>
      Exit.isSuccess(
        decodePreviewCommand({
          rate,
          type: "transport.rate",
        })
      );

    expect([0.25, 0.5, 1, 2].every(decodes)).toBe(true);
    expect(decodes(3)).toBe(false);
  });

  it("accepts hovering an object from the list and leaving it", () => {
    for (const objectId of ["title", null]) {
      expect(
        Exit.isSuccess(
          decodePreviewCommand({
            objectId,
            type: "studio.hover",
          })
        )
      ).toBe(true);
    }
  });

  it("accepts a seek back to the frame a selection was made on", () => {
    const decoded = decodePreviewCommand(seekCommand(42));

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "seek" &&
        decoded.value.frame
    ).toBe(42);
  });

  it("accepts a typed live tuning update", () => {
    expect(
      Exit.isSuccess(
        decodePreviewCommand(
          tuneSetCommand("tune-1", "target-1", "style.scale", 1.2)
        )
      )
    ).toBe(true);
  });

  it("accepts resetting either one field or an entire target", () => {
    expect(
      Exit.isSuccess(
        decodePreviewCommand(
          tuneResetCommand("tune-1", "target-1", ["style.scale"])
        )
      )
    ).toBe(true);
    expect(
      Exit.isSuccess(
        decodePreviewCommand(tuneResetCommand("tune-2", "target-1", []))
      )
    ).toBe(true);
  });

  it("accepts a replay of the element's own window", () => {
    const decoded = decodePreviewCommand(
      replayCommand({ from: 408, until: 424 })
    );

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "replay" && [
          decoded.value.from,
          decoded.value.until,
        ]
    ).toEqual([408, 424]);
  });

  it("accepts the bare pause", () => {
    expect(Exit.isSuccess(decodePreviewCommand(pauseCommand()))).toBe(true);
  });

  it("carries the codemod's statuses back to the page whole", () => {
    const decoded = decodePreviewCommand(
      tuningStatusesCommand([
        {
          nodePath: {
            absolutePath: "/videos/promo/src/Title.tsx",
            effectKeys: [],
            nodePath: ["program", "body", 0, "openingElement"],
            sequenceKeys: ["style.opacity"],
            videoConfigValues: {
              durationInFrames: 300,
              fps: 30,
              height: 1080,
              width: 1920,
            },
          },
          props: {
            "style.opacity": {
              kind: "keyframed",
              status: { keyframes: [{ frame: 0, value: 0 }] },
            },
          },
          targetId: "anchor::Title",
        },
      ])
    );

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "tuning.statuses" &&
        decoded.value.targets[0]?.props["style.opacity"]?.kind
    ).toBe("keyframed");
  });

  it("refuses statuses naming a target with no id", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand(
          tuningStatusesCommand([{ nodePath: null, props: {}, targetId: "" }])
        )
      )
    ).toBe(true);
  });

  it("carries a hide with its selectors and the unhide that ends it", () => {
    const hidden = decodePreviewCommand(
      hideCommand("remove-1", [managedSelector("subtitle")])
    );
    expect(Exit.isSuccess(hidden) && hidden.value).toEqual({
      selectors: ['[data-studio-object="subtitle"]'],
      token: "remove-1",
      type: "studio.hide",
    });
    expect(
      Exit.isSuccess(decodePreviewCommand(unhideCommand("remove-1")))
    ).toBe(true);
    expect(
      Exit.isFailure(decodePreviewCommand(hideCommand("remove-1", [""])))
    ).toBe(true);
  });

  it("refuses a fractional frame", () => {
    expect(Exit.isFailure(decodePreviewCommand(seekCommand(4.5)))).toBe(true);
  });

  it("refuses a command the entry does not know how to obey", () => {
    expect(Exit.isFailure(decodePreviewCommand({ type: "explode" }))).toBe(
      true
    );
  });
});

describe("the selection's Interactive chain", () => {
  const target = {
    componentName: "<Interactive.Div>",
    fields: [
      {
        arrayItemType: null,
        description: null,
        group: "Layer",
        label: "Opacity",
        max: 1,
        maxLength: null,
        min: 0,
        minLength: null,
        newItemDefault: null,
        options: [],
        path: "style.opacity",
        step: 0.01,
        targetId: "div-1",
        type: "number",
        value: 1,
      },
    ],
    instanceId: '[data-design-id="claim"] > :nth-child(2)',
    instances: 4,
    name: "Pushed line",
    ordinal: 2,
    targetId: "div-1",
    where: {
      column: 11,
      file: "/Users/me/video/src/components/WordPush.tsx",
      line: 245,
    },
  };

  it("decodes the chain the page posts, innermost first", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [target, { ...target, componentName: "Title", targetId: "t-1" }],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.map((each) => each.targetId)
    ).toEqual(["div-1", "t-1"]);
  });

  it("decodes the anchored key the page now mints for a target", () => {
    const key = `${target.instanceId}::<Interactive.Div>`;
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [
        {
          ...target,
          fields: [{ ...target.fields[0], targetId: key }],
          targetId: key,
        },
      ],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.at(0)
    ).toMatchObject({ fields: [{ targetId: key }], targetId: key });
  });

  it("decodes the text and family fields a newer Remotion declares", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [
        {
          ...target,
          fields: [
            {
              ...target.fields[0],
              path: "children",
              type: "text-content",
              value: "Ship it",
            },
            {
              ...target.fields[0],
              path: "style.fontFamily",
              type: "font-family",
              value: "Geist",
            },
          ],
        },
      ],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.at(0)?.fields.map((each) => each.type)
    ).toEqual(["text-content", "font-family"]);
  });

  it("decodes a field the pane may show and may not edit", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [
        {
          ...target,
          fields: [
            {
              ...target.fields[0],
              path: "style.letterSpacing",
              readOnly: true,
              type: "text-content",
              value: "-0.03em",
            },
          ],
        },
      ],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.at(0)?.fields.at(0)?.readOnly
    ).toBe(true);
  });

  it("reads a field from an older build as one it may edit", () => {
    const decoded = decodePreviewMessage({ ...selected, tuning: [target] });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.at(0)?.fields.at(0)?.readOnly
    ).toBeUndefined();
  });

  // Every field says which target owns it, or an edit could not be routed.
  it("refuses a field with no target of its own", () => {
    const { targetId, ...orphan } = target.fields[0] as Record<string, unknown>;

    expect(
      Exit.isFailure(
        decodePreviewMessage({
          ...selected,
          tuning: [{ ...target, fields: [orphan] }],
        })
      )
    ).toBe(true);
    expect(targetId).toBe("div-1");
  });

  it("reads a page that sent no chain at all as an empty one", () => {
    const { tuning, ...withoutTuning } = selected;
    const decoded = decodePreviewMessage(withoutTuning);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning
    ).toEqual([]);
    expect(tuning).toEqual([]);
  });

  it("carries the instance, its name, its ordinal and where it is", () => {
    const decoded = decodePreviewMessage({ ...selected, tuning: [target] });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.at(0)
    ).toMatchObject({
      instanceId: '[data-design-id="claim"] > :nth-child(2)',
      instances: 4,
      name: "Pushed line",
      ordinal: 2,
      where: { line: 245 },
    });
  });

  it("defaults everything a page from an older build never sent", () => {
    const { instanceId, instances, name, ordinal, where, ...older } = target;
    const { repeat, ...withoutRepeat } = selected;
    const decoded = decodePreviewMessage({
      ...withoutRepeat,
      tuning: [older],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" && {
          repeat: decoded.value.repeat,
          target: decoded.value.tuning.at(0),
        }
    ).toMatchObject({
      repeat: false,
      target: {
        instanceId: "",
        instances: 1,
        name: null,
        ordinal: 1,
        where: null,
      },
    });
    expect([instanceId, instances, name, ordinal, where, repeat]).toBeDefined();
  });

  it("refuses a location with no file to point at", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          ...selected,
          tuning: [{ ...target, where: { column: null, file: "", line: 1 } }],
        })
      )
    ).toBe(true);
  });
});
