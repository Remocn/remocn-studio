import { beforeEach, describe, expect, it } from "bun:test";
import { withSurface } from "@/test/surface";
import {
  controlsAt,
  controlsChain,
  describeTuning,
  fieldAt,
  isFieldValue,
  isPlumbing,
  labelFor,
  nearestInteractive,
  plainName,
  publishPlan,
  rebind,
  sameMappings,
} from "./tuning";

const SCHEMA = {
  amount: {
    default: 12,
    description: "Amount",
    max: 40,
    min: 0,
    step: 1,
    type: "number" as const,
  },
  mode: {
    default: "plain",
    description: "Mode",
    type: "enum" as const,
    variants: {
      plain: {},
      shimmer: {
        "style.translate": {
          default: "0px 12px",
          description: "Offset",
          step: 1,
          type: "translate" as const,
        },
      },
    },
  },
  stops: {
    default: [0, 1],
    item: { type: "number" as const },
    maxLength: 4,
    minLength: 2,
    newItemDefault: 0,
    type: "array" as const,
  },
} as const;

describe("describeTuning", () => {
  it("serializes supported controls with their constraints", () => {
    expect(
      describeTuning({
        componentName: "Hero",
        schema: SCHEMA,
        targetId: "hero-1",
        values: { amount: 20, mode: "plain", stops: [0, 0.5, 1] },
      })
    ).toMatchObject({
      componentName: "Hero",
      fields: [
        { max: 40, min: 0, path: "amount", type: "number", value: 20 },
        { options: ["plain", "shimmer"], path: "mode", type: "enum" },
        { maxLength: 4, minLength: 2, path: "stops", type: "array" },
      ],
      targetId: "hero-1",
    });
  });

  it("shows only the selected enum branch", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: SCHEMA,
      targetId: "hero-1",
      values: { amount: 20, mode: "shimmer", stops: [0, 1] },
    });

    expect(tuning?.fields.map((field) => field.path)).toContain(
      "style.translate"
    );
  });

  it("groups fields by what moment of the element's life they touch", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        durationInFrames: { default: 30, type: "number" },
        effectStrength: { default: 1, type: "number" },
        label: { default: "Hi", type: "color" },
        "style.translate": { default: "0px 0px", type: "translate" },
        "transitionIn.blur": { default: 4, type: "number" },
        "transitionOut.fade": { default: 1, type: "number" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(
      Object.fromEntries(
        (tuning?.fields ?? []).map((field) => [field.path, field.group])
      )
    ).toEqual({
      durationInFrames: "Timing",
      effectStrength: "Effects",
      label: "Parameters",
      "style.translate": "Transform",
      "transitionIn.blur": "Entry",
      "transitionOut.fade": "Exit",
    });
  });

  it("sorts a design tool's groups apart", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        fillColor: { default: "#fff", type: "color" },
        hidden: { default: false, type: "boolean" },
        strokeWidth: { default: 1, type: "number" },
        "style.color": { default: "#000", type: "color" },
        "style.opacity": { default: 1, max: 1, min: 0, type: "number" },
        "style.translate": { default: "0px 0px", type: "translate" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(
      Object.fromEntries(
        (tuning?.fields ?? []).map((field) => [field.path, field.group])
      )
    ).toEqual({
      fillColor: "Fill",
      hidden: "Layer",
      strokeWidth: "Stroke",
      "style.color": "Typography",
      "style.opacity": "Layer",
      "style.translate": "Transform",
    });
  });

  // Remotion marks `from`, `durationInFrames`, `trimBefore` and `freeze` as
  // belonging to a timeline rather than a property list, and the panel is not
  // a timeline.
  it("honours the schema's own hiddenFromList", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        amount: { default: 3, type: "number" },
        from: { default: 0, hiddenFromList: true, type: "number" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.map((field) => field.path)).toEqual(["amount"]);
  });

  it("skips hidden and unknown future field types without failing", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        amount: { default: 3, type: "number" },
        internal: { default: 1, type: "hidden" },
        novel: { default: 1, type: "holo-gradient" as never },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.map((field) => field.path)).toEqual(["amount"]);
  });

  it("falls back to the schema default when no value is mounted", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: SCHEMA,
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.find((field) => field.path === "amount")?.value).toBe(
      12
    );
  });

  it("refuses out-of-bounds numbers instead of clamping them", () => {
    const amount = fieldAt(SCHEMA, { mode: "plain" }, "amount");

    expect(amount !== null && isFieldValue(amount, 41)).toBe(false);
    expect(amount !== null && isFieldValue(amount, -1)).toBe(false);
    expect(amount !== null && isFieldValue(amount, Number.NaN)).toBe(false);
  });

  it("validates uv coordinates as bounded pairs", () => {
    const schema = {
      focus: { max: 1, min: 0, type: "uv-coordinate" as const },
    };
    const field = fieldAt(schema, {}, "focus");

    expect(field !== null && isFieldValue(field, [0.2, 0.8])).toBe(true);
    expect(field !== null && isFieldValue(field, [0.2, 1.4])).toBe(false);
    expect(field !== null && isFieldValue(field, [0.2])).toBe(false);
  });

  it("validates values against the active field and array constraints", () => {
    const amount = fieldAt(SCHEMA, { mode: "plain" }, "amount");
    const stops = fieldAt(SCHEMA, { mode: "plain" }, "stops");

    expect(amount !== null && isFieldValue(amount, 32)).toBe(true);
    expect(amount !== null && isFieldValue(amount, "32")).toBe(false);
    expect(stops !== null && isFieldValue(stops, [0, 1])).toBe(true);
    expect(stops !== null && isFieldValue(stops, [0])).toBe(false);
    expect(stops !== null && isFieldValue(stops, [0, "1"])).toBe(false);
  });
});

describe("text and type", () => {
  const TEXT_SCHEMA = {
    children: { default: "", type: "text-content" as const },
    "style.fontFamily": { default: "Inter", type: "font-family" as const },
    "style.fontWeight": {
      default: "400",
      type: "enum" as const,
      variants: ["100", "400", "800", "900"],
    },
    "style.letterSpacing": { step: 0.1, type: "number" as const },
  };

  function shown(values: Readonly<Record<string, unknown>>) {
    const tuning = describeTuning({
      componentName: "<Interactive.H1>",
      schema: TEXT_SCHEMA,
      targetId: "h1-1",
      values,
    });

    return Object.fromEntries(
      (tuning?.fields ?? []).map((field) => [field.path, field])
    );
  }

  it("carries the text and the family as their own field types", () => {
    const fields = shown({
      children: "Ship it",
      "style.fontFamily": "Geist",
      "style.fontWeight": "800",
      "style.letterSpacing": -1.2,
    });

    expect(fields.children).toMatchObject({
      readOnly: false,
      type: "text-content",
      value: "Ship it",
    });
    expect(fields["style.fontFamily"]).toMatchObject({
      readOnly: false,
      type: "font-family",
      value: "Geist",
    });
  });

  it("accepts a string for the two new types", () => {
    const text = fieldAt(TEXT_SCHEMA, {}, "children");
    const family = fieldAt(TEXT_SCHEMA, {}, "style.fontFamily");

    expect(text !== null && isFieldValue(text, "Ship it")).toBe(true);
    expect(family !== null && isFieldValue(family, "Geist")).toBe(true);
    expect(text !== null && isFieldValue(text, 12)).toBe(false);
  });

  it("reads the number the agent wrote as the option the schema declares", () => {
    const fields = shown({ children: "Ship it", "style.fontWeight": 800 });

    expect(fields["style.fontWeight"]).toMatchObject({
      readOnly: false,
      type: "enum",
      value: "800",
    });
  });

  it("keeps a unit string as a row that cannot be dragged", () => {
    const fields = shown({
      children: "Ship it",
      "style.letterSpacing": "-0.03em",
    });

    expect(fields["style.letterSpacing"]).toMatchObject({
      label: "Letter spacing",
      readOnly: true,
      type: "text-content",
      value: "-0.03em",
    });
  });

  it("says the text is built from parts when the runtime has no string", () => {
    const fields = shown({ children: undefined });

    expect(fields.children).toMatchObject({
      description: "Text is built from parts — ask in words",
      readOnly: true,
      type: "text-content",
      value: "",
    });
  });

  it("keeps anything else it cannot read as a row saying so", () => {
    const fields = shown({
      children: "Ship it",
      "style.fontWeight": { from: 400, to: 800 },
    });

    expect(fields["style.fontWeight"]).toMatchObject({
      description: "value in code",
      readOnly: true,
      type: "text-content",
      value: '{"from":400,"to":800}',
    });
  });

  it("keeps its row for a value that cannot be printed as JSON", () => {
    const circular: Record<string, unknown> = { weight: 800 };
    circular.self = circular;

    const fields = shown({
      children: "Ship it",
      "style.fontWeight": circular,
    });

    expect(fields["style.fontWeight"]).toMatchObject({
      description: "value in code",
      readOnly: true,
      type: "text-content",
    });
  });

  it("drops a key the runtime holds no value for at all", () => {
    const fields = shown({ children: "Ship it" });

    expect(fields["style.letterSpacing"]).toBeUndefined();
  });

  it("groups a component's own typography keys with the styled ones", () => {
    const tuning = describeTuning({
      componentName: "WordPush",
      schema: {
        backgroundColor: { default: "#000", type: "color" },
        color: { default: "#fff", type: "color" },
        fontSize: { default: 104, type: "number" },
        fontWeight: { default: "800", type: "enum", variants: ["400", "800"] },
        letterSpacing: { default: -1, type: "number" },
        lineHeight: { default: 1.1, type: "number" },
      },
      targetId: "push-1",
      values: {},
    });

    expect(
      Object.fromEntries(
        (tuning?.fields ?? []).map((field) => [field.path, field.group])
      )
    ).toEqual({
      backgroundColor: "Fill",
      color: "Typography",
      fontSize: "Typography",
      fontWeight: "Typography",
      letterSpacing: "Typography",
      lineHeight: "Typography",
    });
  });

  it("puts the text first among the typography it belongs to", () => {
    const tuning = describeTuning({
      componentName: "<Interactive.H1>",
      schema: TEXT_SCHEMA,
      targetId: "h1-1",
      values: {
        children: "Ship it",
        "style.fontFamily": "Geist",
        "style.fontWeight": "800",
        "style.letterSpacing": -1.2,
      },
    });

    expect(
      (tuning?.fields ?? [])
        .filter((field) => field.group === "Typography")
        .map((field) => field.path)
        .at(0)
    ).toBe("children");
  });
});

describe("an asset field", () => {
  const IMG_SCHEMA = {
    src: { default: undefined, description: "Source", type: "asset" as const },
  };

  function shown(values: Readonly<Record<string, unknown>>) {
    const tuning = describeTuning({
      componentName: "<Interactive.Img>",
      schema: IMG_SCHEMA,
      targetId: "img-1",
      values,
    });

    return tuning?.fields.at(0) ?? null;
  }

  beforeEach(() => {
    withSurface({ assets: "/static-abc" });
  });

  // Before this it was not in `SUPPORTED` at all, so a picture-carrying
  // element opened a pane with nothing in it and nothing saying why.
  it("is a row, grouped with what the element is painted with", () => {
    expect(shown({ src: "/static-abc/library/logo%20one.png" })).toMatchObject({
      group: "Fill",
      label: "Source",
      readOnly: false,
      type: "asset",
      value: "library/logo one.png",
    });
  });

  // A composition is free to point at a picture that is not the project's.
  it("keeps a value that names no static file of ours", () => {
    expect(shown({ src: "https://example.com/a.png" })?.value).toBe(
      "https://example.com/a.png"
    );
  });

  it("is dropped when the runtime holds nothing for it", () => {
    expect(shown({ src: undefined })).toBeNull();
  });
});

describe("publishPlan", () => {
  const KEYFRAMED = {
    keyframes: [
      { frame: 0, value: 0 },
      { frame: 30, value: 1 },
    ],
    status: "keyframed",
  };

  const STATUSES = {
    nodePath: null,
    props: {
      hidden: { kind: "static" as const, status: { status: "static" } },
      "style.color": {
        kind: "computed" as const,
        status: { status: "computed" },
      },
      "style.opacity": { kind: "keyframed" as const, status: KEYFRAMED },
    },
    targetId: "title-1",
  };

  it("hands a keyframed key its own status, so the animation survives the edit", () => {
    const plan = publishPlan(
      { "style.opacity": { frame: 12, value: 0.4 } },
      STATUSES
    );

    expect(plan.overrides).toEqual([
      { frame: 12, keyframed: KEYFRAMED, path: "style.opacity", value: 0.4 },
    ]);
    expect(plan.statuses.props["style.opacity"]).toBe(KEYFRAMED);
  });

  it("publishes every status the codemod read, edited or not", () => {
    const plan = publishPlan({ hidden: { frame: 0, value: true } }, STATUSES);

    expect(Object.keys(plan.statuses.props).sort()).toEqual([
      "hidden",
      "style.color",
      "style.opacity",
    ]);
  });

  // A computed key has no status an override merges into: the runtime takes
  // the incoming prop and drops the override. The frame has to move while the
  // person composes the request, so this one key is told it is static.
  it("stands a computed key on a static status while it is being edited", () => {
    const plan = publishPlan(
      { "style.color": { frame: 0, value: "#fff" } },
      STATUSES
    );

    expect(plan.overrides).toEqual([
      { frame: 0, keyframed: null, path: "style.color", value: "#fff" },
    ]);
    expect(plan.statuses.props["style.color"]).toEqual({
      codeValue: "#fff",
      keyframeDisplayOffsetAdjustment: null,
      status: "static",
    });
  });

  // A Remotion older than 4.0.513 answers nothing, and so does a file the
  // resolver could not read. The pane still works there; only writing is lost.
  it("falls back to a static status for every drafted key with no statuses", () => {
    const plan = publishPlan(
      {
        hidden: { frame: 0, value: true },
        "style.fontSize": { frame: 0, value: 120 },
      },
      null
    );

    expect(plan.overrides.map((step) => step.path)).toEqual([
      "hidden",
      "style.fontSize",
    ]);
    expect(plan.statuses.props).toEqual({
      hidden: {
        codeValue: true,
        keyframeDisplayOffsetAdjustment: null,
        status: "static",
      },
      "style.fontSize": {
        codeValue: 120,
        keyframeDisplayOffsetAdjustment: null,
        status: "static",
      },
    });
  });

  it("withdraws every status once the draft is empty, so animations run again", () => {
    const plan = publishPlan({}, null);

    expect(plan.overrides).toEqual([]);
    expect(plan.statuses).toEqual({ canUpdate: true, effects: [], props: {} });
  });
});

describe("nearestInteractive", () => {
  function mounted() {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    inner.append(leaf);
    outer.append(inner);
    document.body.append(outer);
    return { inner, leaf, outer };
  }

  it("resolves the deepest registered sequence containing the element", () => {
    const { inner, leaf, outer } = mounted();
    const sequences = [
      { controls: { overrideId: "outer" }, refForOutline: { current: outer } },
      { controls: { overrideId: "inner" }, refForOutline: { current: inner } },
    ];

    expect(nearestInteractive(sequences, leaf)?.controls).toEqual({
      overrideId: "inner",
    });
  });

  it("distinguishes two instances of the same component", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);
    const sequences = [
      {
        controls: { overrideId: "title-1" },
        refForOutline: { current: first },
      },
      {
        controls: { overrideId: "title-2" },
        refForOutline: { current: second },
      },
    ];

    expect(nearestInteractive(sequences, second)?.controls).toEqual({
      overrideId: "title-2",
    });
  });

  it("ignores sequences with no controls or no mounted outline", () => {
    const { leaf, outer } = mounted();
    const sequences = [
      { controls: null, refForOutline: { current: outer } },
      { controls: { overrideId: "gone" }, refForOutline: { current: null } },
      { controls: { overrideId: "off" }, refForOutline: null },
    ];

    expect(nearestInteractive(sequences, leaf)).toBeNull();
  });
});

describe("controlsAt", () => {
  const CONTROLS = {
    componentName: "Title",
    currentRuntimeValueDotNotation: { amount: 12 },
    overrideId: "title-1",
    schema: SCHEMA,
  };

  function chain(...props: (Record<string, unknown> | null)[]) {
    let fiber: unknown = null;
    for (const memoizedProps of props) {
      fiber = { memoizedProps, return: fiber, type: null };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  // Remotion resolves a `<Sequence layout="none">`'s outline ref to null unless
  // the author passed `outlineRef`, so the DOM search misses a component that
  // is otherwise entirely correct. The prop is on the fiber either way.
  it("finds the controls a component passed, with no outline ref anywhere", () => {
    expect(controlsAt(chain({ controls: CONTROLS }, null))).toEqual(CONTROLS);
  });

  it("takes the innermost interactive ancestor", () => {
    const outer = { ...CONTROLS, componentName: "Scene", overrideId: "scene" };

    expect(
      controlsAt(chain({ controls: outer }, { controls: CONTROLS }, null))
    ).toEqual(CONTROLS);
  });

  it("is not fooled by other props called controls", () => {
    expect(controlsAt(chain({ controls: true }, null))).toBeNull();
    expect(
      controlsAt(chain({ controls: { overrideId: "" } }, null))
    ).toBeNull();
    expect(
      controlsAt(chain({ controls: { overrideId: "x", schema: null } }, null))
    ).toBeNull();
  });

  it("answers nothing outside a React tree", () => {
    expect(controlsAt(document.createElement("div"))).toBeNull();
  });
});

describe("controlsChain", () => {
  function chainOf(...props: (Record<string, unknown> | null)[]) {
    let fiber: unknown = null;
    for (const memoizedProps of props) {
      fiber = { memoizedProps, return: fiber, type: null };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  const div = {
    componentName: "<Interactive.Div>",
    currentRuntimeValueDotNotation: {},
    overrideId: "div-1",
    schema: {},
  };
  const title = {
    componentName: "Title",
    currentRuntimeValueDotNotation: {},
    overrideId: "title-1",
    schema: {},
  };

  // The conventions ask for both wrappers, so this nesting is the normal shape
  // of agent-written markup — not an edge case.
  it("collects every interactive around the element, innermost first", () => {
    expect(
      controlsChain(chainOf({ controls: title }, { controls: div }, null)).map(
        (each) => each.controls.overrideId
      )
    ).toEqual(["div-1", "title-1"]);
  });

  it("counts one interactive once, however many fibers carry its controls", () => {
    expect(
      controlsChain(chainOf({ controls: div }, { controls: div }, null))
    ).toHaveLength(1);
  });
});

describe("the name the agent wrote", () => {
  it("comes off the runtime values", () => {
    expect(
      describeTuning({
        componentName: "<Interactive.Div>",
        schema: SCHEMA,
        targetId: "div-1",
        values: {
          amount: 20,
          mode: "plain",
          name: "Pushed line",
          stops: [0, 1],
        },
      })?.name
    ).toBe("Pushed line");
  });

  it("is nothing when the element was never named", () => {
    expect(
      describeTuning({
        componentName: "<Interactive.Div>",
        schema: SCHEMA,
        targetId: "div-1",
        values: { amount: 20, mode: "plain", stops: [0, 1] },
      })?.name
    ).toBeNull();
    expect(
      describeTuning({
        componentName: "<Interactive.Div>",
        schema: SCHEMA,
        targetId: "div-1",
        values: { amount: 20, mode: "plain", name: "", stops: [0, 1] },
      })?.name
    ).toBeNull();
  });

  it("counts the instance it was picked from", () => {
    expect(
      describeTuning({
        componentName: "<Interactive.Div>",
        instanceId: '[data-design-id="claim"] > :nth-child(2)',
        instances: 4,
        ordinal: 2,
        schema: SCHEMA,
        targetId: "div-1",
        values: { amount: 20, mode: "plain", stops: [0, 1] },
      })
    ).toMatchObject({
      instanceId: '[data-design-id="claim"] > :nth-child(2)',
      instances: 4,
      ordinal: 2,
      where: null,
    });
  });

  it("is alone by default", () => {
    expect(
      describeTuning({
        componentName: "Hero",
        schema: SCHEMA,
        targetId: "hero-1",
        values: { amount: 20, mode: "plain", stops: [0, 1] },
      })
    ).toMatchObject({ instanceId: "", instances: 1, ordinal: 1 });
  });
});

describe("isPlumbing", () => {
  const SERIES = {
    hidden: { default: false, type: "boolean" as const },
    layout: {
      default: "absolute-fill",
      type: "enum" as const,
      variants: ["absolute-fill", "none"],
    },
  };

  it("is true for a schema that is only hidden and layout", () => {
    const target = describeTuning({
      componentName: "<Series>",
      schema: SERIES,
      targetId: "series-1",
      values: {},
    });

    expect(target !== null && isPlumbing(target)).toBe(true);
  });

  it("is false for a component with parameters of its own", () => {
    const target = describeTuning({
      componentName: "Hero",
      schema: SCHEMA,
      targetId: "hero-1",
      values: { amount: 20, mode: "plain", stops: [0, 1] },
    });

    expect(target !== null && isPlumbing(target)).toBe(false);
  });

  it("is false for a schema that only adds one real control to those two", () => {
    const target = describeTuning({
      componentName: "Card",
      schema: { ...SERIES, amount: SCHEMA.amount },
      targetId: "card-1",
      values: { amount: 4 },
    });

    expect(target !== null && isPlumbing(target)).toBe(false);
  });
});

describe("labelFor", () => {
  // Remotion's own built-ins describe themselves in two words, and those read
  // better than the path would.
  it("takes a short description as the label", () => {
    expect(labelFor("Font size", "style.fontSize")).toBe("Font size");
    expect(labelFor("Opacity", "style.opacity")).toBe("Opacity");
  });

  // What an agent writes is prose, and prose is not a label whatever the pane
  // does with it — it belongs under the control.
  it("falls back to the prop's own name when the description is a sentence", () => {
    expect(
      labelFor(
        "Frames per drift cycle — kept coprime with the ambient periods",
        "driftCycleFrames"
      )
    ).toBe("Drift cycle frames");
    expect(labelFor("Horizontal drift amplitude in pixels", "driftX")).toBe(
      "Drift x"
    );
  });

  it("names the prop when there is no description at all", () => {
    expect(labelFor(undefined, "style.transformOrigin")).toBe(
      "Transform origin"
    );
    expect(labelFor("", "easing")).toBe("Easing");
  });
});

describe("rebind", () => {
  function outlined(
    componentName: string,
    overrideId: string,
    node: Element | null
  ) {
    return {
      controls: { componentName, overrideId },
      refForOutline: { current: node },
    };
  }

  function fixture() {
    const scene = document.createElement("div");
    const line = document.createElement("span");
    const word = document.createElement("em");

    scene.append(line);
    line.append(word);
    document.body.append(scene);

    return { line, scene, word };
  }

  it("follows the live id of a component that remounted under the same anchor", () => {
    const { line, word } = fixture();
    const entries = [
      {
        anchor: ".line",
        componentName: "WordPush",
        key: ".line::WordPush",
        live: ["gone"],
      },
    ];

    expect(
      rebind(entries, [outlined("WordPush", "fresh", line)], () => word)
    ).toEqual([{ key: ".line::WordPush", live: ["fresh"], node: word }]);
  });

  it("empties the live set when the anchor no longer resolves", () => {
    const { line } = fixture();
    const entries = [
      {
        anchor: ".gone",
        componentName: "WordPush",
        key: ".gone::WordPush",
        live: ["was"],
      },
    ];

    expect(
      rebind(entries, [outlined("WordPush", "was", line)], () => null)
    ).toEqual([{ key: ".gone::WordPush", live: [], node: null }]);
  });

  it("empties the live set when nothing registered carries that component", () => {
    const { word } = fixture();
    const entries = [
      {
        anchor: ".line",
        componentName: "WordPush",
        key: ".line::WordPush",
        live: ["was"],
      },
    ];

    expect(
      rebind(
        entries,
        [],
        () => word,
        () => []
      )
    ).toEqual([{ key: ".line::WordPush", live: [], node: word }]);
  });

  it("takes the deepest outline that contains the node", () => {
    const { line, scene, word } = fixture();
    const entries = [
      {
        anchor: ".line",
        componentName: "Interactive.Div",
        key: ".line::Interactive.Div",
        live: [],
      },
    ];

    const [bound] = rebind(
      entries,
      [
        outlined("Interactive.Div", "outer", scene),
        outlined("Interactive.Div", "inner", line),
      ],
      () => word
    );

    expect(bound.live).toEqual(["inner", "outer"]);
  });

  it("ignores an outline that does not contain the node", () => {
    const { line, word } = fixture();
    const elsewhere = document.createElement("p");

    document.body.append(elsewhere);

    const [bound] = rebind(
      [{ anchor: ".line", componentName: "WordPush", key: "k", live: [] }],
      [
        outlined("WordPush", "away", elsewhere),
        outlined("WordPush", "here", line),
      ],
      () => word
    );

    expect(bound.live).toEqual(["here"]);
  });

  it("falls back to the fibers when every outline ref is null", () => {
    const { word } = fixture();

    const [bound] = rebind(
      [
        {
          anchor: ".line",
          componentName: "ClaimScene",
          key: "k",
          live: ["stale"],
        },
      ],
      [
        {
          controls: { componentName: "ClaimScene", overrideId: "stale" },
          refForOutline: null,
        },
      ],
      () => word,
      () => [
        { componentName: "Interactive.Div", overrideId: "div" },
        { componentName: "ClaimScene", overrideId: "live" },
      ]
    );

    expect(bound.live).toEqual(["live"]);
  });

  it("keeps every chained id a component name matches", () => {
    const { word } = fixture();

    const [bound] = rebind(
      [{ anchor: ".line", componentName: "Row", key: "k", live: [] }],
      [],
      () => word,
      () => [
        { componentName: "Row", overrideId: "one" },
        { componentName: "Row", overrideId: "two" },
        { componentName: "Row", overrideId: "one" },
      ]
    );

    expect(bound.live).toEqual(["one", "two"]);
  });

  it("rebinds each entry on its own anchor", () => {
    const { line, scene, word } = fixture();

    const bound = rebind(
      [
        {
          anchor: ".word",
          componentName: "Interactive.Div",
          key: "a",
          live: [],
        },
        { anchor: ".scene", componentName: "ClaimScene", key: "b", live: [] },
      ],
      [
        outlined("Interactive.Div", "div", line),
        outlined("ClaimScene", "claim", scene),
      ],
      (anchor) => (anchor === ".word" ? word : scene)
    );

    expect(bound.map((entry) => entry.live)).toEqual([["div"], ["claim"]]);
  });
});

describe("sameMappings", () => {
  const path = { absolutePath: "remocn.1" };
  const other = { absolutePath: "remocn.2" };

  it("is true for the same keys pointing at the same paths", () => {
    expect(sameMappings({ a: path }, { a: path })).toBe(true);
  });

  it("is false when a key was added", () => {
    expect(sameMappings({ a: path }, { a: path, b: other })).toBe(false);
  });

  it("is false when a key was dropped", () => {
    expect(sameMappings({ a: path, b: other }, { a: path })).toBe(false);
  });

  it("is false when a key points somewhere else", () => {
    expect(sameMappings({ a: path }, { a: other })).toBe(false);
  });
});

describe("plainName", () => {
  it("drops Remotion's spelling of an element primitive", () => {
    expect(plainName("<Interactive.Div>")).toBe("Div");
  });

  it("leaves a component's own name alone", () => {
    expect(plainName("WordPush")).toBe("WordPush");
  });
});
