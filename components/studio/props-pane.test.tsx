import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { PropsPanel } from "@/components/studio/props-pane";
import type { PendingComment, TuningRefusal } from "@/hooks/use-inspect";
import type { TuningField, TuningTarget } from "@/lib/studio/preview";
import type { PromptElement } from "@/shared/ipc";

const ELEMENT: PromptElement = {
  column: 7,
  component: "Title",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/videos/intro/index.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

function field(overrides: Partial<TuningField>): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Parameters",
    label: "Field",
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path: "field",
    step: null,
    targetId: "title-1",
    type: "number",
    value: 0,
    ...overrides,
  };
}

const SHARED_LINE = /Shared by/;

const WHERE = {
  column: 7,
  file: "/Users/me/projects/my-video/src/videos/intro/index.tsx",
  line: 12,
};

function link(overrides: Partial<TuningTarget> = {}): TuningTarget {
  return {
    componentName: "Title",
    fields: [],
    identity: null,
    instanceId: '[data-design-id="title"]',
    instances: 1,
    keys: [],
    name: null,
    ordinal: 1,
    origin: WHERE,
    targetId: "title-1",
    where: WHERE,
    ...overrides,
  };
}

function draw(
  fields: readonly TuningField[],
  handlers: Partial<{
    assetBase: string;
    groups: { collapsed: readonly string[]; toggle: (group: string) => void };
    assets: readonly string[];
    card: PendingComment;
    deletion: { label: string; reason: string | null };
    frame: number;
    onCancel: () => void;
    onDelete: () => void;
    onOpenTarget: (index: number) => void;
    onChange: (path: string, value: unknown) => void;
    onChangeText: (value: string) => void;
    onReplay: () => void;
    onReset: (paths?: readonly string[]) => void;
    onSeek: (frame: number) => void;
    onSubmit: (comment: string) => void;
    originals: Record<string, unknown>;
    refusal: TuningRefusal | null;
    target: TuningTarget;
  }> = {}
) {
  const target = handlers.target ?? link({ fields });
  const card: PendingComment = {
    assetBase: handlers.assetBase ?? null,
    assets: handlers.assets ?? [],
    element: ELEMENT,
    frames: {},
    open: 0,
    originals: {
      "title-1": (handlers.originals ??
        Object.fromEntries(fields.map((f) => [f.path, f.value]))) as never,
    },
    rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
    statuses: {},
    targets: [target],
    tuning: target,
    video: null,
    window: { from: 30, until: 60 },
  };
  const shown = handlers.card ?? card;

  return render(
    <PropsPanel
      card={shown}
      cwd="/Users/me/projects/my-video"
      deletion={handlers.deletion}
      frames={stillFrames(handlers.frame ?? 42)}
      groups={handlers.groups}
      onCancel={handlers.onCancel ?? mock()}
      onChange={(handlers.onChange ?? mock()) as never}
      onChangeText={handlers.onChangeText ?? mock()}
      onDelete={handlers.onDelete}
      onOpenTarget={handlers.onOpenTarget}
      onReplay={handlers.onReplay ?? mock()}
      onReset={handlers.onReset ?? mock()}
      onSeek={handlers.onSeek ?? mock()}
      onSubmit={handlers.onSubmit ?? mock()}
      refusal={handlers.refusal ?? null}
      target={shown.tuning ?? target}
    />
  );
}

function stillFrames(frame: number) {
  return { frameOf: () => frame, onFrame: () => () => undefined };
}

describe("PropsPanel", () => {
  it("names the component and where it came from", () => {
    draw([field({ label: "Font size", path: "size" })]);

    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("src/videos/intro/index.tsx:12")).toBeDefined();
  });

  it("titles itself with the name the agent wrote", () => {
    draw([field({ label: "Font size", path: "size" })], {
      target: link({
        componentName: "<Interactive.Div>",
        fields: [field({ label: "Font size", path: "size" })],
        name: "Pushed line",
      }),
    });

    expect(screen.getByText("Pushed line")).toBeDefined();
    expect(screen.queryByText("<Interactive.Div>")).toBeNull();
  });

  it("badges which instance it opened on, and only when there are several", () => {
    draw([field({ label: "Font size", path: "size" })], {
      target: link({
        fields: [field({ label: "Font size", path: "size" })],
        instances: 4,
        ordinal: 2,
      }),
    });

    expect(screen.getByText("2 of 4")).toBeDefined();
  });

  it("shows no badge for the only instance there is", () => {
    draw([field({ label: "Font size", path: "size" })]);

    expect(screen.queryByText("1 of 1")).toBeNull();
  });

  // A design tool's order: where the thing is, then how it composites, then
  // its own parameters, with timing last.
  it("orders groups the way a design tool does", () => {
    draw([
      field({ group: "Timing", label: "From", path: "from" }),
      field({ group: "Parameters", label: "Size", path: "size" }),
      field({ group: "Layer", label: "Opacity", path: "style.opacity" }),
      field({ group: "Transform", label: "Offset", path: "style.translate" }),
    ]);

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((node) => node.textContent);

    expect(headings).toEqual(["Transform", "Layer", "Parameters", "Timing"]);
  });

  it("gives every number a typed, scrubbable field", () => {
    draw([field({ label: "Offset", path: "offset", value: 4 })]);

    expect((screen.getByLabelText("Offset") as HTMLInputElement).value).toBe(
      "4"
    );
  });

  it("renders a bounded number through DialKit with its exact range", () => {
    const { container } = draw([
      field({ label: "Blur", max: 40, min: 0, path: "blur", value: 12 }),
    ]);

    const slider = screen.getByRole("slider", { name: "Blur" });

    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("40");
    expect(slider.getAttribute("aria-valuenow")).toBe("12");
    expect(container.querySelector(".dialkit-slider-fill")).not.toBeNull();
  });

  it("leaves an unbounded number without a fill", () => {
    const { container } = draw([
      field({ label: "Offset", path: "offset", value: 4 }),
    ]);

    expect(container.querySelector("[data-fill]")).toBeNull();
  });

  it("keeps a DialKit slider adjustable from the keyboard", () => {
    const onChange = mock();
    draw([field({ label: "Blur", max: 40, min: 0, path: "blur", value: 12 })], {
      onChange,
    });

    fireEvent.keyDown(screen.getByRole("slider", { name: "Blur" }), {
      key: "ArrowRight",
    });

    expect(onChange).toHaveBeenCalledWith("blur", 13);
  });

  it("puts a two-value transform on one pad, Y the way up a pad has it", () => {
    const onChange = mock();
    const { container } = draw(
      [
        field({
          group: "Transform",
          label: "Offset",
          path: "style.translate",
          type: "translate",
          value: "-12px 8px",
        }),
      ],
      { onChange }
    );

    // Two sliders were what this used to be. A position is one gesture, and
    // the pad measures its Y upward where the CSS measures it down.
    expect(container.querySelector(".dialkit-pad-plane")).not.toBeNull();
    expect(container.querySelectorAll("[role='slider']").length).toBe(0);
    expect((screen.getByLabelText("Offset X") as HTMLInputElement).value).toBe(
      "-12"
    );
    expect((screen.getByLabelText("Offset Y") as HTMLInputElement).value).toBe(
      "-8"
    );

    fireEvent.keyDown(screen.getByLabelText("Offset Y"), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("style.translate", "-12px 7px");
  });

  it("shows opacity as a percentage and stores it as a fraction", () => {
    const onChange = mock();
    draw(
      [
        field({
          group: "Layer",
          label: "Opacity",
          max: 1,
          min: 0,
          path: "style.opacity",
          step: 0.01,
          value: 0.42,
        }),
      ],
      { onChange }
    );

    const opacity = screen.getByRole("slider", { name: "Opacity" });
    expect(opacity.getAttribute("aria-valuenow")).toBe("42");

    fireEvent.keyDown(opacity, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("style.opacity", 0.43);
  });

  it("reports a switch and an enum through onChange", () => {
    const onChange = mock();
    draw(
      [
        field({
          label: "Hidden",
          path: "hidden",
          type: "boolean",
          value: false,
        }),
        field({
          label: "Emphasis",
          options: ["none", "glow"],
          path: "emphasis",
          type: "enum",
          value: "none",
        }),
      ],
      { onChange }
    );

    // 2.0 draws a Toggle as a segmented radiogroup; 1.4.3 drew plain buttons.
    fireEvent.click(screen.getByRole("radio", { name: "On" }));
    expect(onChange).toHaveBeenCalledWith("hidden", true);

    fireEvent.click(screen.getByRole("button", { name: "Emphasis None" }));
    fireEvent.click(screen.getByRole("button", { name: "Glow" }));
    expect(onChange).toHaveBeenCalledWith("emphasis", "glow");
  });

  it("offers per-row reset and Reset all only once a value moved", () => {
    const onReset = mock();
    const moved = [field({ label: "Size", path: "size", value: 7 })];

    draw(moved, { onReset, originals: { size: 0 } });

    fireEvent.click(screen.getByLabelText("Reset Size"));
    expect(onReset).toHaveBeenCalledWith(["size"]);

    fireEvent.click(screen.getByText("Reset all"));
    expect(onReset).toHaveBeenCalledWith();
  });

  it("hides Reset all while nothing has moved", () => {
    draw([field({ label: "Size", path: "size" })]);

    expect(screen.queryByText("Reset all")).toBeNull();
  });

  it("counts the changes on the Add button", () => {
    draw([field({ label: "Size", path: "size", value: 7 })], {
      originals: { size: 0 },
    });

    expect(screen.getByText("Add 1")).toBeDefined();
  });

  it("holds array rows to their length constraints", () => {
    const onChange = mock();
    const { container } = draw(
      [
        field({
          arrayItemType: "number",
          label: "Stops",
          maxLength: 2,
          minLength: 2,
          newItemDefault: 0,
          path: "stops",
          type: "array",
          value: [0.1, 0.4],
        }),
      ],
      { onChange }
    );

    expect(
      container
        .querySelector("[data-slot='array-items']")
        ?.classList.contains("gap-1")
    ).toBe(true);

    expect(screen.getByLabelText("Add Stops").hasAttribute("disabled")).toBe(
      true
    );
    expect(
      screen.getByLabelText("Remove Stops 1").hasAttribute("disabled")
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Stops 1"), {
      target: { value: "0.3" },
    });
    expect(onChange).toHaveBeenCalledWith("stops", [0.3, 0.4]);
  });

  it("gives an easing enum a curve and a preset picker", () => {
    const onChange = mock();
    const { container } = draw(
      [
        field({
          group: "Entry",
          label: "Easing",
          options: ["linear", "ease-out"],
          path: "entry.easing",
          type: "enum",
          value: "ease-out",
        }),
      ],
      { onChange }
    );

    expect(container.querySelector(".dialkit-easing-curve")).not.toBeNull();
    // An enum holds one of its own names, so the curve is a reading: dialkit
    // is handed no `onChange` and disables both of its handles.
    expect(
      [
        ...container.querySelectorAll<HTMLButtonElement>(
          ".dialkit-easing-handle"
        ),
      ].map((handle) => handle.disabled)
    ).toEqual([true, true]);

    fireEvent.click(screen.getByRole("button", { name: "Curve Ease-Out" }));
    fireEvent.click(screen.getByRole("button", { name: "Linear" }));
    expect(onChange).toHaveBeenCalledWith("entry.easing", "linear");
  });

  it("keeps a long easing label out of the constrained preset picker", () => {
    draw([
      field({
        label: "Easing used by the title slide transition",
        options: ["linear", "ease-out"],
        path: "entry.easing",
        type: "enum",
        value: "ease-out",
      }),
    ]);

    // The field label already sits beside the curve. Repeating it inside the
    // narrow select gives DialKit a max-content width that escapes the pane.
    expect(
      screen.getByRole("button", { name: "Curve Ease-Out" })
    ).toBeDefined();
  });

  it("edits a bezier easing through presets and its numbers", () => {
    const onChange = mock();
    const { container } = draw(
      [
        field({
          arrayItemType: "number",
          label: "Easing",
          path: "easing",
          type: "array",
          value: [0.42, 0, 0.58, 1],
        }),
      ],
      { onChange }
    );

    const handles = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".dialkit-easing-handle"
      ),
    ];

    expect(handles.map((handle) => handle.disabled)).toEqual([false, false]);

    fireEvent.keyDown(handles[0] as HTMLButtonElement, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("easing", [0.43, 0, 0.58, 1]);

    fireEvent.click(
      screen.getByRole("button", { name: "Preset Ease In & Out" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Ease Out" }));
    expect(onChange).toHaveBeenCalledWith("easing", [0, 0, 0.58, 1]);

    fireEvent.change(screen.getByLabelText("Easing x1"), {
      target: { value: "0.5" },
    });
    fireEvent.blur(screen.getByLabelText("Easing x1"));
    expect(onChange).toHaveBeenCalledWith("easing", [0.5, 0, 0.58, 1]);
  });

  it("shows a colour as its own text beside a swatch", () => {
    draw([
      field({
        label: "Tint",
        path: "tint",
        type: "color",
        value: "#8b7bff",
      }),
    ]);

    expect(
      (screen.getByLabelText("Tint color value") as HTMLInputElement).value
    ).toBe("#8b7bff");
    expect(
      screen.getByRole("button", { name: "Pick tint color" })
    ).toBeDefined();
  });

  // `colorValue()` used to turn anything that was not a hex into #000000,
  // because 1.4.3 read hex alone. Nothing coerces the value now, so a
  // `zColor()` default written as rgb() reaches the row as itself.
  it("keeps a colour that was not written as a hex", () => {
    draw([
      field({
        label: "Tint",
        path: "tint",
        type: "color",
        value: "rgb(139, 123, 255)",
      }),
    ]);

    expect(
      (screen.getByLabelText("Tint color value") as HTMLInputElement).value
    ).toBe("rgb(139, 123, 255)");
  });

  it("says why the preview refused a change instead of reverting in silence", () => {
    draw([field({ label: "Size", path: "size" })], {
      refusal: {
        message: "That value is not valid for this control.",
        path: null,
        targetId: null,
      },
    });

    expect(
      screen.getByText("That value is not valid for this control.")
    ).toBeDefined();
  });

  it("puts a refusal that named a row beside that row", () => {
    const { container } = draw(
      [
        field({ label: "Size", path: "size" }),
        field({ label: "Blur", path: "blur" }),
      ],
      {
        refusal: {
          message: "This element is not on screen at frame 300.",
          path: "blur",
          targetId: "title-1",
        },
      }
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(
      "This element is not on screen at frame 300."
    );
    const footer = screen.getByLabelText(
      "What should change about this element?"
    ).parentElement;
    expect(footer?.contains(alert)).toBe(false);
    expect(container.contains(alert)).toBe(true);
  });

  it("leaves the other rows unmarked", () => {
    draw(
      [
        field({ label: "Size", path: "size" }),
        field({ label: "Blur", path: "blur" }),
      ],
      {
        refusal: {
          message: "This element is not on screen at frame 300.",
          path: "blur",
          targetId: "another-target",
        },
      }
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when an edit reaches every instance of the element", () => {
    draw([field({ label: "Size", path: "size" })], {
      target: link({
        fields: [field({ label: "Size", path: "size" })],
        instances: 3,
        ordinal: 1,
      }),
    });

    expect(
      screen.getByText("Shared by 3 · a change here moves all of them")
    ).toBeDefined();
  });

  it("says nothing about sharing for the only instance there is", () => {
    draw([field({ label: "Size", path: "size" })]);

    expect(screen.queryByText(SHARED_LINE)).toBeNull();
  });

  it("cancels and submits from the footer", () => {
    const onCancel = mock();
    const onSubmit = mock();
    draw([field({ label: "Size", path: "size" })], { onCancel, onSubmit });

    fireEvent.change(
      screen.getByLabelText("What should change about this element?"),
      { target: { value: "Bigger" } }
    );
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmit).toHaveBeenCalledWith("Bigger");

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});

// Selecting a word lands on Remotion's markup primitive; the component that
// renders it — and carries its easing — is one level out. Merging the two was
// the first answer and it put the whole scene's camera in the pane.
describe("the Interactive chain", () => {
  const inner = link({
    componentName: "<Interactive.Div>",
    fields: [field({ label: "Opacity", path: "style.opacity", value: 1 })],
    instanceId: '[data-design-id="line-1"] > :nth-child(1)',
    targetId: "div-1",
  });
  const outer = link({
    componentName: "CameraRig",
    fields: [field({ label: "Easing", path: "easing", value: 2 })],
    instanceId: '[data-design-id="line-1"]',
    targetId: "rig-1",
  });

  function chained(open: number, onOpenTarget = mock()) {
    const card: PendingComment = {
      element: ELEMENT,
      frames: {},
      open,
      originals: { "div-1": {}, "rig-1": {} },
      rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
      statuses: {},
      targets: [inner, outer],
      tuning: [inner, outer][open] as never,
      video: null,
    };

    return {
      onOpenTarget,
      ...draw(card.tuning?.fields ?? [], { card, onOpenTarget }),
    };
  }

  it("shows only the open target's fields, and offers the rest", () => {
    chained(0);

    expect(screen.getByLabelText("Opacity")).toBeDefined();
    expect(screen.queryByLabelText("Easing")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Which component to edit" })
    ).toBeDefined();
  });

  // `<Interactive.Div>` is Remotion's own spelling; the brackets are plumbing.
  it("names the chain the way a person reads it", () => {
    chained(0);

    expect(screen.getByRole("button", { name: "Div" })).toBeDefined();
    expect(screen.getByRole("button", { name: "CameraRig" })).toBeDefined();
  });

  it("prefers the agent's own name on a chip", () => {
    const card: PendingComment = {
      element: ELEMENT,
      frames: {},
      open: 0,
      originals: { "div-1": {}, "rig-1": {} },
      rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
      statuses: {},
      targets: [{ ...inner, name: "Pushed line" }, outer],
      tuning: { ...inner, name: "Pushed line" },
      video: null,
    };

    draw(inner.fields, { card, onOpenTarget: mock() });

    expect(screen.getByRole("button", { name: "Pushed line" })).toBeDefined();
  });

  it("says what it is inside, and where that is", () => {
    chained(0);

    expect(
      screen.getByText("Div in CameraRig · src/videos/intro/index.tsx:12")
    ).toBeDefined();
  });

  it("asks to switch when an ancestor is picked", () => {
    const { onOpenTarget } = chained(0);

    fireEvent.click(screen.getByRole("button", { name: "CameraRig" }));
    expect(onOpenTarget).toHaveBeenCalledWith(1);
  });

  it("shows no switcher when there is nothing to switch to", () => {
    draw([field({ label: "Size", path: "size" })]);

    expect(
      screen.queryByRole("navigation", { name: "Which component to edit" })
    ).toBeNull();
  });
});

// Every other control is a dialkit pill with its label inside it. The easing
// editor is a canvas, a picker and four numbers, and forcing it into the row
// grid reserved a label column the pills do not have — so it sat in a narrower
// second column and the pane read as two competing alignments.
describe("the easing block's structure", () => {
  function easing() {
    return draw([
      field({
        arrayItemType: "number",
        label: "Drift easing",
        path: "easing",
        type: "array",
        value: [0, 0, 0.58, 1],
      }),
    ]);
  }

  it("stacks under one label at the pane's own edge, like the X/Y pairs", () => {
    const { container } = easing();
    const block = container.querySelector(".dialkit-composite-control");

    expect(block).not.toBeNull();
    expect(block?.querySelector(".dialkit-composite-label")?.textContent).toBe(
      "Drift easing"
    );
    expect(block?.querySelector(".dialkit-easing-viz")).not.toBeNull();
  });

  it("keeps its four handles in the block, not in a column of their own", () => {
    const { container } = easing();
    const handles = container.querySelector(
      ".dialkit-composite-control .dialkit-easing-handles"
    );

    expect(
      ["x1", "y1", "x2", "y2"].map(
        (axis) =>
          handles?.querySelector(`[aria-label="Drift easing ${axis}"]`) !== null
      )
    ).toEqual([true, true, true, true]);
  });

  // The reset action shares the slot every other control puts it in.
  it("carries its action where a pill carries one", () => {
    const { container } = easing();

    expect(
      container.querySelector(
        ".dialkit-control-with-action > .dialkit-control-action"
      )
    ).not.toBeNull();
  });
});

describe("the time strip", () => {
  it("reads the frozen frame beside the element's own window", () => {
    draw([field({ label: "Size", path: "size" })], { frame: 412 });

    expect(screen.getByText("frame 412 · enters 30–60")).toBeDefined();
    expect(screen.getByLabelText("Frame")).toBeDefined();
  });

  it("moves the frame from the range", () => {
    const onSeek = mock();
    draw([field({ label: "Size", path: "size" })], { frame: 40, onSeek });

    fireEvent.change(screen.getByLabelText("Frame"), {
      target: { value: "48" },
    });

    expect(onSeek).toHaveBeenCalledWith(48);
  });

  it("plays the window on Replay", () => {
    const onReplay = mock();
    draw([field({ label: "Size", path: "size" })], { onReplay });

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(onReplay).toHaveBeenCalled();
  });

  it("shows the frame alone, with Replay off, for an element with no window", () => {
    const target = link({ fields: [field({ label: "Size", path: "size" })] });
    const card: PendingComment = {
      element: ELEMENT,
      frames: {},
      open: 0,
      originals: { "title-1": {} },
      rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
      statuses: {},
      targets: [target],
      tuning: target,
      video: null,
      window: null,
    };

    draw(target.fields, { card, frame: 412 });

    expect(screen.getByText("frame 412")).toBeDefined();
    expect(screen.queryByLabelText("Frame")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Replay" })
        .getAttribute("aria-disabled")
    ).toBe("true");
  });

  it("badges a row the runtime animates, and warns what a fixed value costs", () => {
    const target = link({
      fields: [field({ label: "Offset", path: "offset", value: 12 })],
    });
    const card: PendingComment = {
      element: ELEMENT,
      frames: {},
      open: 0,
      originals: { "title-1": { offset: 12 } },
      rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
      statuses: {
        "title-1": {
          id: "title-1",
          nodePath: null,
          props: { offset: { kind: "keyframed", status: {} } },
          reason: null,
        },
      },
      targets: [target],
      tuning: target,
      video: null,
      window: { from: 30, until: 60 },
    };

    draw(target.fields, { card });

    expect(screen.getByText("Animated")).toBeDefined();
    expect(
      screen.getByText(
        "a change here moves the value at this frame; the animation keeps running"
      )
    ).toBeDefined();
  });

  it("leaves a row the runtime holds still unbadged", () => {
    draw([field({ label: "Offset", path: "offset", value: 12 })]);

    expect(screen.queryByText("animated")).toBeNull();
  });

  it("says out loud that a curve is only visible while the element moves", () => {
    draw([
      field({
        label: "Easing",
        options: ["linear", "ease-in"],
        path: "easing",
        type: "enum",
        value: "linear",
      }),
    ]);

    expect(
      screen.getByText(
        "A curve only shows while the element moves. Replay to watch it."
      )
    ).toBeDefined();
  });
});

describe("the text a Remotion too old to declare it still shows", () => {
  function withText(text: { draft: string; from: string } | null) {
    const shown = [field({ label: "Size", path: "size" })];
    const target = link({ fields: shown });

    return {
      card: {
        element: ELEMENT,
        frames: {},
        open: 0,
        originals: { "title-1": { size: 0 } },
        rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
        statuses: {},
        targets: [target],
        text,
        tuning: target,
        video: null,
        window: { from: 30, until: 60 },
      } as PendingComment,
      fields: shown,
    };
  }

  it("offers the words, and says they are not previewed", () => {
    const { card, fields } = withText({ draft: "Ship it", from: "Ship it" });
    draw(fields, { card });

    expect((screen.getByLabelText("Text") as HTMLTextAreaElement).value).toBe(
      "Ship it"
    );
    expect(screen.getByText("sent to the agent, not previewed")).toBeDefined();
  });

  it("shows no Text section when the runtime carries the words itself", () => {
    const { card, fields } = withText(null);
    draw(fields, { card });

    expect(screen.queryByLabelText("Text")).toBeNull();
    expect(screen.queryByText("sent to the agent, not previewed")).toBeNull();
  });

  it("reports what was typed", () => {
    const onChangeText = mock();
    const { card, fields } = withText({ draft: "Ship it", from: "Ship it" });
    draw(fields, { card, onChangeText });

    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Ship it today" },
    });

    expect(onChangeText).toHaveBeenCalledWith("Ship it today");
  });

  it("counts an edited text among the changes on the Add button", () => {
    const { card, fields } = withText({
      draft: "Ship it today",
      from: "Ship it",
    });
    draw(fields, { card });

    expect(screen.getByText("Add 1")).toBeDefined();
  });
});

describe("a picture and a spring", () => {
  // `asset` was not in `SUPPORTED` at all: an element carrying a picture drew
  // a pane with the picture missing from it and nothing saying why.
  it("offers the project's own pictures for an asset field", () => {
    const base = "http://127.0.0.1:5173/static-abc/";
    const { container } = draw(
      [
        field({
          group: "Fill",
          label: "Source",
          path: "src",
          type: "asset",
          value: "bg.png",
        }),
      ],
      { assetBase: base, assets: ["bg.png", "library/logo.png"] }
    );

    expect(
      container.querySelector<HTMLImageElement>(".dialkit-image-img")?.src
    ).toBe(`${base}bg.png`);
    expect(screen.getByText("bg.png")).toBeDefined();
  });

  // Damping, stiffness and mass are one movement, so the response leads them
  // rather than leaving three unrelated dials to be read as three parameters.
  it("draws a spring's response above its three numbers", () => {
    const { container } = draw([
      field({ label: "Damping", path: "spring.damping", value: 20 }),
      field({ label: "Stiffness", path: "spring.stiffness", value: 180 }),
      field({ label: "Mass", path: "spring.mass", value: 1 }),
    ]);

    // The response leads the three numbers rather than sitting under them.
    const viz = container.querySelector(".dialkit-spring-viz");
    const row = viz?.closest(".dialkit-composite-control");

    expect(screen.getByText("Spring")).toBeDefined();
    expect(row?.parentElement?.children.length).toBe(4);
    expect(row?.previousElementSibling).toBeNull();
  });

  it("leaves a section with no spring in it alone", () => {
    const { container } = draw([
      field({ label: "Blur", path: "blur", value: 4 }),
    ]);

    expect(container.querySelector(".dialkit-spring-viz")).toBeNull();
  });
});

const TRANSFORM = /Transform/;

describe("folding a section", () => {
  const rows = [
    field({ group: "Transform", label: "Offset", path: "a", value: 1 }),
    field({ group: "Layer", label: "Opacity", path: "b", value: 2 }),
  ];

  it("opens every section when nothing has been folded", () => {
    draw(rows, { groups: { collapsed: [], toggle: mock() } });

    expect(
      screen
        .getByRole("button", { name: "Transform" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByLabelText("Offset")).toBeDefined();
  });

  it("hides the rows of a folded section and says how many there are", () => {
    draw(rows, { groups: { collapsed: ["Transform"], toggle: mock() } });

    const heading = screen.getByRole("button", { name: TRANSFORM });

    expect(heading.getAttribute("aria-expanded")).toBe("false");
    expect(heading.textContent).toContain("1");
    // Hidden, not unmounted: a fold must not throw away an edit in progress.
    expect(screen.getByLabelText("Offset")).toBeDefined();
    expect(screen.getByLabelText("Offset").closest("[hidden]")).not.toBeNull();
    expect(screen.getByLabelText("Opacity").closest("[hidden]")).toBeNull();
  });

  it("names the section it folds", () => {
    const toggle = mock();
    draw(rows, { groups: { collapsed: [], toggle } });

    fireEvent.click(screen.getByRole("button", { name: "Layer" }));

    expect(toggle).toHaveBeenCalledWith("Layer");
  });
});

describe("Delete in the header", () => {
  it("deletes every instance of a shared call site", () => {
    const onDelete = mock();
    draw([field({ label: "Font size", path: "size" })], {
      deletion: { label: "Delete all 4", reason: null },
      onDelete,
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete all 4" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("stays in place, inert, with its reason when the element cannot be deleted", () => {
    const onDelete = mock();
    draw([field({ label: "Font size", path: "size" })], {
      deletion: {
        label: "Delete",
        reason: "The studio cannot delete this: the file is not TypeScript.",
      },
      onDelete,
    });
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
