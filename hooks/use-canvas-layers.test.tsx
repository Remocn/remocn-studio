import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import type { PreviewScene } from "@/lib/studio/preview";
import type { PreviewMessage } from "@/preview/protocol";
import type { StudioObject } from "@/shared/studio-document";
import { previewControl } from "@/test/preview-channel";
import { useCanvasLayers } from "./use-canvas-layers";

function object(
  id: string,
  parentId: string | null = null,
  definition = "box",
  label = id
): StudioObject {
  return { definition, id, label, parentId, values: {} };
}

const OBJECTS = [
  object("hero"),
  object("title", "hero"),
  object("card"),
  object("price", "card"),
];

function setup(
  selected: string | null = null,
  objects = OBJECTS,
  scenes: readonly PreviewScene[] = []
) {
  const { preview, surface } = previewControl();
  const select = mock();
  const seekTo = mock();
  const deletion = { openRowMenu: mock(), remove: mock(), undo: mock() };
  const viewport = document.createElement("div");
  viewport.tabIndex = 0;
  document.body.append(viewport);
  const managed = (id: string | null) => ({
    enabled: true,
    error: null,
    isOpen: id !== null,
    loading: false,
    objects,
    select,
    selected: objects.find((item) => item.id === id) ?? null,
  });
  const hook = renderHook(
    ({
      hasRoom,
      picked,
      selection,
    }: {
      hasRoom?: boolean;
      picked?: string | null;
      selection: unknown;
    }) =>
      useCanvasLayers({
        deletion,
        hasRoom,
        managed: managed(picked === undefined ? selected : picked),
        preview,
        scenes,
        seekTo,
        selection,
        viewport: { current: viewport },
      }),
    {
      initialProps: { selection: selected } as {
        hasRoom?: boolean;
        picked?: string | null;
        selection: unknown;
      },
    }
  );
  const emit = (message: PreviewMessage) => act(() => surface.emit(message));
  const { sent } = surface;
  const press = (init: KeyboardEventInit, target: Element = viewport) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };
  return {
    ...hook,
    deletion,
    emit,
    press,
    preview,
    seekTo,
    select,
    sent,
    viewport,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("useCanvasLayers", () => {
  it("lists the objects as a tree", () => {
    const { result } = setup();

    expect(result.current.rows.map((row) => `${row.depth}:${row.id}`)).toEqual([
      "0:hero",
      "1:title",
      "0:card",
      "1:price",
    ]);
  });

  it("treats every object as on screen until the runtime says", () => {
    const { result } = setup();

    expect(result.current.rows.every(result.current.isPresent)).toBe(true);
  });

  it("dims what the runtime has not mounted, and forgets it on a rebuild", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], type: "studio.present" });

    expect(
      result.current.rows.filter(result.current.isPresent).map((row) => row.id)
    ).toEqual(["title"]);

    emit({ type: "rebuilt" });

    expect(result.current.rows.every(result.current.isPresent)).toBe(true);
  });

  it("asks the runtime to outline a hovered row and to stop", () => {
    const { result, sent } = setup();
    act(() => result.current.hover("card"));
    act(() => result.current.hover(null));

    expect(sent).toEqual([
      { objectId: "card", type: "studio.hover" },
      { objectId: null, type: "studio.hover" },
    ]);
  });

  it("selects a row the way a click on the canvas does", () => {
    const { result, select, sent } = setup();
    act(() => result.current.select("price"));

    expect(select).toHaveBeenCalledWith("price");
    expect(sent.at(-1)).toEqual({ objectId: null, type: "studio.hover" });
  });

  it("tabs through the objects on screen in list order", () => {
    const { emit, press, select } = setup("title");
    emit({
      ids: ["title", "card"],
      type: "studio.present",
    });

    const event = press({});

    expect(event.defaultPrevented).toBe(true);
    expect(select).toHaveBeenLastCalledWith("card");

    press({ shiftKey: true });

    expect(select).toHaveBeenLastCalledWith("card");
  });

  it("starts with the first object when nothing is selected", () => {
    const { press, select } = setup();
    press({});

    expect(select).toHaveBeenLastCalledWith("hero");
  });

  it("leaves Tab alone while text is being edited", () => {
    const { press, select, viewport } = setup();
    viewport.setAttribute("data-preview-editing", "");

    expect(press({}).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("leaves Tab alone when nothing is on screen", () => {
    const { emit, press, select } = setup();
    emit({ ids: [], type: "studio.present" });

    expect(press({}).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("leaves Tab to a control inside the canvas", () => {
    const { press, select, viewport } = setup();
    const button = document.createElement("button");
    viewport.append(button);

    expect(press({}, button).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("shows the list while nothing is selected", () => {
    const { result } = setup();

    expect(result.current.view).toBe("layers");
  });

  it("shows the properties of a new selection", () => {
    const { rerender, result } = setup();
    rerender({ selection: "object:title" });

    expect(result.current.view).toBe("properties");
  });

  it("goes back to the list without dropping the selection", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));

    expect(result.current.view).toBe("layers");
    expect(result.current.selectedId).toBe("title");
  });

  it("shows properties again when a row is picked from the list", () => {
    const { rerender, result, select } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    act(() => result.current.select("title"));

    expect(select).toHaveBeenCalledWith("title");
    expect(result.current.view).toBe("properties");
  });

  it("shows properties when the canvas picks something else", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    rerender({ selection: { element: "a heading" } });

    expect(result.current.view).toBe("properties");
  });

  it("forgets the choice once the selection is dropped", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    rerender({ selection: null });
    rerender({ selection: "object:title" });

    expect(result.current.view).toBe("properties");
  });

  function clickView(value: string) {
    return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
  }

  it("starts expanded on the list", () => {
    const { result } = setup();

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
  });

  it("collapses when the active view's icon is clicked, and expands on any", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.onView(clickView("properties")));

    expect(result.current.shown).toBe(false);
    expect(result.current.active).toBeNull();

    act(() => result.current.onView(clickView("layers")));

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
  });

  it("switches views without collapsing", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.onView(clickView("layers")));

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
    expect(result.current.selectedId).toBe("title");
  });

  it("collapses and expands from its own control", () => {
    const { result } = setup();
    act(() => result.current.toggle());

    expect(result.current.shown).toBe(false);

    act(() => result.current.toggle());

    expect(result.current.shown).toBe(true);
  });

  it("folds to its bar when the preview has no room, keeping the choice", () => {
    const { rerender, result } = setup();
    rerender({ hasRoom: false, selection: null });

    expect(result.current.shown).toBe(false);
    expect(result.current.floating).toBe(false);

    rerender({ hasRoom: true, selection: null });

    expect(result.current.shown).toBe(true);
  });

  it("expands over the canvas while folded, and docks when room returns", () => {
    const { rerender, result } = setup();
    rerender({ hasRoom: false, selection: null });
    act(() => result.current.toggle());

    expect(result.current.shown).toBe(true);
    expect(result.current.floating).toBe(true);

    act(() => result.current.onView(clickView("layers")));

    expect(result.current.shown).toBe(false);

    act(() => result.current.toggle());
    rerender({ hasRoom: true, selection: null });

    expect(result.current.shown).toBe(true);
    expect(result.current.floating).toBe(false);

    rerender({ hasRoom: false, selection: null });

    expect(result.current.floating).toBe(false);
  });

  function toggleRow(value: string) {
    return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
  }

  const visibleIds = (result: { current: { visible: { id: string }[] } }) =>
    result.current.visible.map((row) => row.id);

  it("opens the group on screen and closes the rest", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], type: "studio.present" });

    expect(visibleIds(result)).toEqual(["hero", "title", "card"]);
  });

  it("keeps the last video's groups until the next video reports its own", () => {
    const { emit, preview, result } = setup();
    emit({ ids: ["title"], type: "studio.present" });
    act(() =>
      preview.channel.serve("http://127.0.0.1:51749/?composition=Outro")
    );
    emit({
      compositionId: "Outro",
      compositions: ["Main", "Outro"],
      metadata: null,
      reason: "asked",
      total: 2,
      trouble: null,
      type: "composition",
      unmeasured: false,
    });

    expect(visibleIds(result)).toEqual(["hero", "title", "card"]);

    emit({ ids: ["price"], type: "studio.present" });

    expect(visibleIds(result)).toEqual(["hero", "card", "price"]);
  });

  it("keeps a group the person collapsed closed as the playhead moves", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], type: "studio.present" });
    act(() => result.current.onToggle(toggleRow("hero")));
    emit({
      ids: ["title", "price"],
      type: "studio.present",
    });

    expect(visibleIds(result)).toEqual(["hero", "card", "price"]);
  });

  it("opens the groups above an object selected on the canvas", () => {
    const { emit, rerender, result } = setup();
    emit({ ids: ["title"], type: "studio.present" });
    act(() => result.current.onToggle(toggleRow("hero")));

    expect(visibleIds(result)).not.toContain("title");

    rerender({ picked: "title", selection: "object:title" });

    expect(visibleIds(result)).toContain("title");
  });

  it("marks scene objects as scenes", () => {
    const { result } = setup(null, [
      {
        definition: "scene",
        id: "phone",
        label: "Phone",
        parentId: null,
        values: {},
      },
      {
        definition: "box",
        id: "clock",
        label: "Clock",
        parentId: "phone",
        values: {},
      },
    ]);

    expect(result.current.rows.map((row) => row.isScene)).toEqual([
      true,
      false,
    ]);
  });

  describe("scenes on the seek bar", () => {
    const SCENED = [
      object("opening", null, "scene", "Opening"),
      object("title", "opening"),
      object("phone", null, "scene", "Phone"),
      object("device", "phone"),
      object("clock", "device"),
      object("legacy", null, "scene", "Renamed"),
    ];
    const SCENES = [
      { duration: 50, from: 0, id: "a", name: "Opening" },
      { duration: 88, from: 480, id: "b", name: "Phone" },
    ];

    it("moves the playhead to a scene's start when its row is clicked", () => {
      const { result, seekTo, select } = setup(null, SCENED, SCENES);
      act(() => result.current.select("phone"));

      expect(seekTo).toHaveBeenCalledWith(480);
      expect(select).toHaveBeenCalledWith("phone");
    });

    it("moves the playhead to the scene of an object that is off screen", () => {
      const { emit, result, seekTo } = setup(null, SCENED, SCENES);
      emit({
        ids: ["title"],
        type: "studio.present",
      });
      act(() => result.current.select("clock"));

      expect(seekTo).toHaveBeenCalledWith(480);
    });

    it("leaves the playhead alone for an object on screen", () => {
      const { emit, result, seekTo } = setup(null, SCENED, SCENES);
      emit({
        ids: ["title"],
        type: "studio.present",
      });
      act(() => result.current.select("title"));

      expect(seekTo).not.toHaveBeenCalled();
    });

    it("selects without seeking when no scene has the row's name", () => {
      const { result, seekTo, select } = setup(null, SCENED, SCENES);
      act(() => result.current.select("legacy"));

      expect(seekTo).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledWith("legacy");
    });
  });
});

describe("deleting from the canvas and the list", () => {
  it("deletes on Delete and ⌫, and undoes on ⌘Z", () => {
    const { deletion, press } = setup("card");
    expect(press({ key: "Backspace" }).defaultPrevented).toBe(true);
    expect(press({ key: "Delete" }).defaultPrevented).toBe(true);
    expect(deletion.remove).toHaveBeenCalledTimes(2);
    expect(press({ key: "z", metaKey: true }).defaultPrevented).toBe(true);
    expect(deletion.undo).toHaveBeenCalledTimes(1);
  });

  it("leaves the keys to the inline editor, controls and modified presses", () => {
    const { deletion, press, viewport } = setup("card");
    const button = document.createElement("button");
    viewport.append(button);
    expect(press({ key: "Backspace" }, button).defaultPrevented).toBe(false);
    expect(press({ key: "Backspace", metaKey: true }).defaultPrevented).toBe(
      false
    );
    expect(
      press({ key: "z", metaKey: true, shiftKey: true }).defaultPrevented
    ).toBe(false);
    viewport.setAttribute("data-preview-editing", "");
    expect(press({ key: "Backspace" }).defaultPrevented).toBe(false);
    expect(press({ key: "z", metaKey: true }).defaultPrevented).toBe(false);
    expect(deletion.remove).not.toHaveBeenCalled();
    expect(deletion.undo).not.toHaveBeenCalled();
  });

  it("opens the row's menu for its object", () => {
    const { deletion, result } = setup();
    const button = document.createElement("button");
    button.value = "price";
    const preventDefault = mock();
    act(() =>
      result.current.onRowMenu({
        currentTarget: button,
        preventDefault,
      } as unknown as MouseEvent<HTMLButtonElement>)
    );
    expect(preventDefault).toHaveBeenCalled();
    expect(deletion.openRowMenu).toHaveBeenCalledWith("price");
  });
});
