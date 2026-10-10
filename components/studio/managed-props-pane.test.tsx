import { expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ManagedObjects } from "@/hooks/use-managed-objects";
import { documentFixture } from "@/test/fixtures/studio-document";
import { ManagedPropsPane } from "./managed-props-pane";

function fixture(): ManagedObjects {
  return {
    acceptInserted: () => true,
    acceptsPreview: () => true,
    awaitingPreview: false,
    busy: false,
    canUndo: false,
    change: mock(),
    close: mock(),
    commit: mock(),
    definition: documentFixture.definitions[0],
    discard: mock(),
    editingText: false,
    enabled: true,
    error: null,
    fields: [
      {
        ...documentFixture.definitions[0].fields[0],
        error: null,
        saving: false,
        value: "third",
      },
    ],
    isOpen: true,
    loading: false,
    objects: documentFixture.objects,
    open: mock(),
    pending: 0,
    reload: mock(),
    remove: mock(() => Promise.resolve(null)),
    resetShader: () => undefined,
    retry: mock(),
    select: mock(),
    selected: documentFixture.objects[2],
    undo: mock(),
    undoableAt: null,
    undoOperation: mock(),
  };
}

it("offers the full object catalogue and saves text on blur without a composer action", async () => {
  const objects = fixture();
  render(
    <MotionConfig skipAnimations>
      <ManagedPropsPane objects={objects} />
    </MotionConfig>
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
    target: { value: "Edited" },
  });
  expect(objects.change).toHaveBeenCalledWith("text", "Edited");
  fireEvent.blur(screen.getByRole("textbox", { name: "Text" }));
  expect(objects.commit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Element Third" }));
  fireEvent.click(await screen.findByRole("button", { name: "First" }));
  expect(objects.select).toHaveBeenCalledWith("first");
  expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
});

it("renders grouped DialKit controls and commits a held arrow key once", async () => {
  const objects = fixture();
  objects.fields = [
    {
      ...documentFixture.definitions[0].fields[1],
      error: null,
      group: "Typography",
      saving: false,
      value: 48,
    },
  ];
  const { container } = render(<ManagedPropsPane objects={objects} />);
  expect(container.querySelector(".remocn-dialkit")).not.toBeNull();
  const slider = screen.getByRole("slider", { name: "Size" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight", repeat: true });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.change).toHaveBeenCalledTimes(2);
  expect(objects.commit).not.toHaveBeenCalled();
  fireEvent.keyUp(slider, { key: "ArrowRight" });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.commit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  expect(screen.queryByRole("slider", { name: "Size" })).toBeNull();
});

it("normalizes a pasted CSS color with alpha into the managed hex format", async () => {
  const objects = fixture();
  objects.fields = [
    {
      default: "#ffffff",
      error: null,
      id: "fill",
      label: "Fill",
      saving: false,
      type: "color",
      value: "#ffffff",
    },
  ];
  render(<ManagedPropsPane objects={objects} />);
  fireEvent.change(screen.getByLabelText("Fill color value"), {
    target: { value: "rgba(255, 0, 0, 0.5)" },
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.change).toHaveBeenCalledWith("fill", "#ff000080");
  expect(objects.commit).toHaveBeenCalledTimes(1);
});

it("makes pending fields inert while keeping conflict recovery available", () => {
  const objects = fixture();
  objects.fields[0] = {
    ...objects.fields[0],
    error: "Changed elsewhere",
    saving: true,
  };
  objects.error = "Changed elsewhere";
  render(<ManagedPropsPane objects={objects} />);
  expect(
    screen.getByRole("group", { name: "Text property" }).hasAttribute("inert")
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Retry saving" })).toBeEnabled();
});

it("groups held-key edits on unbounded numeric inputs into one save", async () => {
  const objects = fixture();
  objects.fields = [
    {
      default: 0,
      error: null,
      id: "offset",
      label: "Offset",
      saving: false,
      step: 1,
      type: "number",
      value: 0,
    },
  ];
  render(<ManagedPropsPane objects={objects} />);
  const input = screen.getByRole("slider", { name: "Offset" });
  fireEvent.keyDown(input, { key: "ArrowUp" });
  fireEvent.keyDown(input, { key: "ArrowUp", repeat: true });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.commit).not.toHaveBeenCalled();
  fireEvent.keyUp(input, { key: "ArrowUp" });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.change).toHaveBeenCalledTimes(2);
  expect(objects.commit).toHaveBeenCalledTimes(1);
});

it.each([24, 30, 60])(
  "shows frame timing in seconds at %s fps and writes whole frames",
  async (fps) => {
    const objects = fixture();
    objects.fields = [
      {
        default: 30,
        error: null,
        id: "entryFrames",
        label: "Entry duration",
        max: 300,
        min: 0,
        saving: false,
        step: 1,
        type: "number",
        unit: "frames",
        value: 30,
      },
    ];
    render(<ManagedPropsPane fps={fps} objects={objects} />);
    fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
    const input = screen.getByRole("slider", { name: "Entry duration" });
    expect(Number(input.getAttribute("aria-valuenow"))).toBeCloseTo(
      30 / fps,
      3
    );
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyUp(input, { key: "ArrowUp" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(objects.change).toHaveBeenLastCalledWith("entryFrames", 31);
    expect(objects.commit).toHaveBeenCalledTimes(1);
  }
);

it("does not invent a frame rate while metadata is unavailable", () => {
  const objects = fixture();
  objects.fields = [
    {
      default: 30,
      error: null,
      id: "duration",
      label: "Duration",
      max: 300,
      min: 0,
      saving: false,
      step: 1,
      type: "number",
      unit: "frames",
      value: 30,
    },
  ];
  render(<ManagedPropsPane objects={objects} />);
  expect(screen.queryByRole("slider")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(
    screen.getByText("Timing is available when the preview is ready.")
  ).toBeTruthy();
});

it("offers easing presets with a curve and saves the selected preset", async () => {
  const objects = fixture();
  objects.fields = [
    {
      default: "linear",
      error: null,
      id: "entryEasing",
      label: "Entry easing",
      options: ["linear", "easeOut"],
      saving: false,
      type: "enum",
      value: "linear",
    },
  ];
  const { container } = render(
    <MotionConfig skipAnimations>
      <ManagedPropsPane objects={objects} />
    </MotionConfig>
  );
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(container.querySelector(".dialkit-easing-curve")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Entry easing Linear" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ease Out" }));
  expect(objects.change).toHaveBeenCalledWith("entryEasing", "easeOut");
  expect(objects.commit).toHaveBeenCalledTimes(1);
});

it("keeps status and recovery actions in the header outside the scrolling fields", () => {
  const objects = fixture();
  objects.pending = 1;
  objects.error = "Could not save";
  const { container } = render(<ManagedPropsPane objects={objects} />);
  const header = container.querySelector("header");
  expect(header).toContainElement(screen.getByText("Unsaved changes"));
  expect(header).toContainElement(
    screen.getByRole("button", { name: "Discard unsaved changes" })
  );
  expect(header).toContainElement(
    screen.getByRole("button", { name: "Retry saving" })
  );
  expect(container.querySelector("select")).toBeNull();
  expect(header).not.toContainElement(
    screen.getByRole("textbox", { name: "Text" })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Discard unsaved changes" })
  );
  expect(objects.discard).toHaveBeenCalledTimes(1);
});

it.each(["start", "end", "entryDuration", "exitDuration"])(
  "uses the DialKit slider for %s in seconds",
  (id) => {
    const objects = fixture();
    objects.fields = [
      {
        default: 1,
        error: null,
        id,
        label: id,
        max: 20,
        min: 0,
        saving: false,
        step: 0.01,
        type: "number",
        unit: "s",
        value: 0.35,
      },
    ];
    const { container } = render(<ManagedPropsPane objects={objects} />);
    fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
    const label = {
      end: "End time",
      entryDuration: "Entry duration",
      exitDuration: "Exit duration",
      start: "Start time",
    }[id];
    expect(screen.getByRole("slider", { name: label })).toHaveAttribute(
      "aria-valuenow",
      "0.35"
    );
    expect(container.querySelector(".dialkit-slider")).not.toBeNull();
  }
);

it("edits custom Bezier coordinates as one gesture and can return to a preset", async () => {
  const objects = fixture();
  objects.fields = [
    {
      default: [0, 0, 0.58, 1],
      error: null,
      id: "entryEasing",
      label: "Entry easing",
      saving: false,
      type: "easing",
      value: [0.2, -0.3, 0.8, 1.4],
    },
  ];
  render(
    <MotionConfig skipAnimations>
      <ManagedPropsPane objects={objects} />
    </MotionConfig>
  );
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(
    screen.getByRole("button", { name: "Curve coordinates" })
  ).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByText("Curve coordinates"));
  const y = screen.getByRole("slider", { name: "Entry easing Y2" });
  expect(
    screen.getByRole("slider", { name: "Entry easing X1" })
  ).toHaveAttribute("aria-valuemax", "1");
  expect(
    screen.getByRole("slider", { name: "Entry easing Y1" })
  ).toHaveAttribute("aria-valuemin", "-2");
  fireEvent.keyDown(y, { key: "ArrowRight" });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.commit).not.toHaveBeenCalled();
  expect(objects.change).toHaveBeenLastCalledWith(
    "entryEasing",
    [0.2, -0.3, 0.8, 1.41]
  );
  fireEvent.keyUp(y, { key: "ArrowRight" });
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.commit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Preset Custom" }));
  fireEvent.click(await screen.findByRole("button", { name: "Linear" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(objects.change).toHaveBeenLastCalledWith("entryEasing", [0, 0, 1, 1]);
  expect(objects.commit).toHaveBeenCalledTimes(2);
});

it("separates appearance from animation and reveals spring controls only when enabled", () => {
  const objects = fixture();
  const state = { error: null, saving: false };
  objects.fields = [
    objects.fields[0],
    {
      ...state,
      default: false,
      id: "spring",
      label: "spring",
      type: "boolean",
      value: false,
    },
    {
      ...state,
      default: 20,
      id: "damping",
      label: "damping",
      max: 100,
      min: 0,
      type: "number",
      value: 20,
    },
  ];
  const view = render(<ManagedPropsPane objects={objects} />);
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
  expect(screen.queryByText("Use spring")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(screen.getByRole("tab", { name: "Animation" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull();
  expect(screen.getByText("Use spring")).toBeTruthy();
  expect(screen.queryByText("Spring settings")).toBeNull();
  objects.fields[1] = { ...objects.fields[1], value: true };
  view.rerender(<ManagedPropsPane objects={objects} />);
  expect(
    screen.getByRole("button", { name: "Spring settings" })
  ).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("slider", { name: "Damping" })).toBeTruthy();
});

it("keeps unknown controls accessible and saves pending drafts when switching tabs", () => {
  const objects = fixture();
  objects.pending = 1;
  objects.fields = [
    { ...objects.fields[0], id: "customValue", label: "Custom value" },
  ];
  render(<ManagedPropsPane objects={objects} />);
  expect(screen.getByRole("textbox", { name: "Custom value" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(objects.commit).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText("No animation controls for this element.")
  ).toBeTruthy();
});

it("offers Delete in the header beside Undo", () => {
  const onDelete = mock();
  render(
    <ManagedPropsPane
      deletion={{ label: "Delete", reason: null }}
      objects={fixture()}
      onDelete={onDelete}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it("says why a scene cannot be deleted", () => {
  const onDelete = mock();
  render(
    <ManagedPropsPane
      deletion={{
        label: "Delete",
        reason:
          "A scene cannot be deleted: its place on the timeline lives in the code.",
      }}
      objects={fixture()}
      onDelete={onDelete}
    />
  );
  const button = screen.getByRole("button", { name: "Delete" });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(button);
  expect(onDelete).not.toHaveBeenCalled();
});

it("keeps focus in the field when Delete is pressed, so a draft is dropped rather than saved", () => {
  const onDelete = mock();
  render(
    <ManagedPropsPane
      deletion={{ label: "Delete", reason: null }}
      objects={fixture()}
      onDelete={onDelete}
    />
  );
  const pressed = fireEvent.pointerDown(
    screen.getByRole("button", { name: "Delete" })
  );
  expect(pressed).toBe(false);
});

it("explains a dependent shader control and resets through the managed action", () => {
  const objects = fixture();
  objects.resetShader = mock();
  objects.selected = {
    ...documentFixture.objects[0],
    shader: {
      revision: "v1",
      slotId: "root-shaders",
      slug: "shader-mesh-gradient",
    },
  };
  objects.fields = [
    {
      default: true,
      error: null,
      group: "Timing",
      id: "followSceneEnd",
      label: "Follow scene end",
      saving: false,
      type: "boolean",
      value: true,
    },
    {
      availableWhen: {
        field: "followSceneEnd",
        operator: "equals",
        reason: "Turn off Follow scene end to trim the end.",
        value: false,
      },
      default: 150,
      error: null,
      group: "Timing",
      id: "endFrame",
      label: "End",
      saving: false,
      type: "number",
      unit: "frames",
      value: 150,
    },
  ];
  render(<ManagedPropsPane fps={30} objects={objects} />);
  fireEvent.click(screen.getByRole("tab", { name: "Animation" }));
  expect(
    screen.getByText("Turn off Follow scene end to trim the end.")
  ).toBeInTheDocument();
  expect(screen.getByLabelText("End property")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reset shader" }));
  expect(objects.resetShader).toHaveBeenCalledTimes(1);
});
