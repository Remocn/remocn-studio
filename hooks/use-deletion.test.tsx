import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { Effect } from "effect";
import type { ContextAction } from "@/lib/studio/context-menu";
import { SidecarError } from "@/lib/studio/sidecar";
import type { PreviewMessage } from "@/preview/protocol";
import type { StudioObject } from "@/shared/studio-document";
import { previewControl } from "@/test/preview-channel";
import {
  type Notice,
  OFF_SCREEN_REASON,
  SAVING_REASON,
  SCENE_REASON,
  TURN_REASON,
  UPGRADED,
  useDeletion,
} from "./use-deletion";
import type { CodeRemoval, CodeRemoved } from "./use-inspect";
import type { Removal } from "./use-managed-objects";

const heading: StudioObject = {
  definition: "heading",
  id: "subtitle",
  label: "Subtitle",
  parentId: "opening",
  values: {},
};
const scene: StudioObject = {
  definition: "scene",
  id: "opening",
  label: "Opening",
  parentId: null,
  values: {},
};

interface Setup {
  busy?: boolean;
  removal?: CodeRemoval | null;
  removed?: CodeRemoved;
  restoreFails?: string;
  selected?: StudioObject | null;
  turn?: boolean;
  undoableAt?: number | null;
  undoFails?: string;
}

function setup(options: Setup = {}) {
  const { preview, surface } = previewControl({ composition: "intro" });
  const operation = {
    id: "remove-1",
    kind: "remove",
    objectId: "subtitle",
  } as const;
  const managed = {
    busy: options.busy ?? false,
    canUndo: true,
    enabled: true,
    isOpen: options.selected !== null,
    objects: [scene, heading],
    remove: mock(
      (): Promise<Removal | null> =>
        Promise.resolve({
          from: { projectId: "project-1", video: "intro" },
          label: "Subtitle",
          ok: true,
          operation,
          upgraded: "src/videos/intro/index.tsx",
        })
    ),
    selected: options.selected === undefined ? heading : options.selected,
    undo: mock(() => Promise.resolve(options.undoFails ?? null)),
    undoableAt: options.undoableAt === undefined ? null : options.undoableAt,
    undoOperation: mock(() => Promise.resolve(options.undoFails ?? null)),
  };
  const inspect = {
    card: null,
    removal: options.removal ?? null,
    removeCard: mock(
      (): Promise<CodeRemoved | null> =>
        Promise.resolve(
          options.removed ?? { label: "Badge", ok: true, removal: "code-1" }
        )
    ),
  };
  const notices: Notice[] = [];
  const menus: (readonly ContextAction[])[] = [];
  const restore = mock(() =>
    options.restoreFails === undefined
      ? Effect.succeed({ file: "/p/src/Scene.tsx" })
      : Effect.fail(new SidecarError({ message: options.restoreFails }))
  );
  const hook = renderHook(() =>
    useDeletion({
      inspect,
      isTurnRunning: options.turn ?? false,
      managed,
      notify: (notice) => notices.push(notice),
      popup: (actions) => menus.push(actions),
      preview,
      projectId: "project-1",
      restore,
    })
  );
  const emit = (message: PreviewMessage) => act(() => surface.emit(message));
  return {
    ...hook,
    emit,
    inspect,
    managed,
    menus,
    notices,
    operation,
    restore,
  };
}

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("what Delete means right now", () => {
  it("deletes the selected object, and says why it cannot", () => {
    expect(setup().result.current.target).toEqual({
      label: "Delete",
      reason: null,
    });
    expect(setup({ busy: true }).result.current.target?.reason).toBe(
      SAVING_REASON
    );
    expect(setup({ selected: scene }).result.current.target?.reason).toBe(
      SCENE_REASON
    );
    const test = setup();
    test.emit({
      ids: ["opening"],
      type: "studio.present",
    });
    expect(test.result.current.target?.reason).toBe(OFF_SCREEN_REASON);
  });

  it("deletes every instance of a shared call site, but not during a turn", () => {
    const removal = { count: 4, label: "Card", reason: null };
    expect(setup({ removal, selected: null }).result.current.target).toEqual({
      label: "Delete all 4",
      reason: null,
    });
    expect(
      setup({ removal, selected: null, turn: true }).result.current.target
        ?.reason
    ).toBe(TURN_REASON);
  });

  it("offers nothing when nothing is selected", () => {
    expect(setup({ selected: null }).result.current.target).toBeNull();
  });
});

describe("deleting", () => {
  it("removes a managed object and offers its Undo, naming the upgrade", async () => {
    const test = setup();
    act(() => test.result.current.remove());
    await settle();
    expect(test.managed.remove).toHaveBeenCalledWith("subtitle");
    expect(test.notices[0]).toMatchObject({
      description: UPGRADED,
      title: "Deleted “Subtitle”",
    });
    test.notices[0].undo?.();
    expect(test.managed.undoOperation).toHaveBeenCalledWith(test.operation, {
      projectId: "project-1",
      video: "intro",
    });
  });

  it("removes a picked element from the code and undoes it with ⌘Z", async () => {
    const test = setup({
      removal: { count: 1, label: "Badge", reason: null },
      selected: null,
      undoableAt: 1,
    });
    act(() => test.result.current.remove());
    await settle();
    expect(test.inspect.removeCard).toHaveBeenCalled();
    expect(test.notices[0]?.title).toBe("Deleted “Badge”");
    act(() => test.result.current.undo());
    await settle();
    expect(test.restore).toHaveBeenCalledWith({
      projectId: "project-1",
      removal: "code-1",
    });
    expect(test.managed.undo).not.toHaveBeenCalled();
    act(() => test.result.current.undo());
    expect(test.managed.undo).toHaveBeenCalled();
  });

  it("undoes a newer property edit before an older code removal", async () => {
    const test = setup({
      removal: { count: 1, label: "Badge", reason: null },
      selected: null,
      undoableAt: Date.now() + 60_000,
    });
    act(() => test.result.current.remove());
    await settle();
    act(() => test.result.current.undo());
    expect(test.managed.undo).toHaveBeenCalled();
    expect(test.restore).not.toHaveBeenCalled();
  });

  it("says so when the code removal cannot be undone", async () => {
    const test = setup({
      removal: { count: 1, label: "Badge", reason: null },
      restoreFails:
        "The file changed since the deletion, so it cannot be undone.",
      selected: null,
    });
    act(() => test.result.current.remove());
    await settle();
    act(() => test.result.current.undo());
    await settle();
    expect(test.notices.at(-1)).toEqual({
      title: "The file changed since the deletion, so it cannot be undone.",
      type: "error",
    });
  });

  it("reports a refused deletion as a sentence", async () => {
    const test = setup({
      removal: { count: 1, label: "Badge", reason: null },
      removed: { error: "The file changed while deleting.", ok: false },
      selected: null,
    });
    act(() => test.result.current.remove());
    await settle();
    expect(test.notices).toEqual([
      { title: "The file changed while deleting.", type: "error" },
    ]);
  });
});

describe("menus", () => {
  it("opens Delete for the object a right-click picked", async () => {
    const test = setup();
    test.emit({ type: "canvas.menu" });
    expect(test.menus).toHaveLength(1);
    expect(test.menus[0][0]).toMatchObject({ enabled: true, text: "Delete" });
    test.menus[0][0].run();
    await settle();
    expect(test.managed.remove).toHaveBeenCalledWith("subtitle");
  });

  it("opens no menu for a scene", () => {
    const test = setup({ selected: scene });
    test.emit({ type: "canvas.menu" });
    expect(test.menus).toHaveLength(0);
  });

  it("disables Delete in a row menu for an object that is not on screen, or a scene", () => {
    const test = setup();
    test.emit({
      ids: ["opening"],
      type: "studio.present",
    });
    act(() => test.result.current.openRowMenu("subtitle"));
    act(() => test.result.current.openRowMenu("opening"));
    expect(test.menus.map((menu) => menu[0].enabled)).toEqual([false, false]);
  });
});

describe("an Undo that cannot apply", () => {
  it("says why when the notice's Undo is refused", async () => {
    const test = setup({
      undoFails:
        "Subtitle changed since it was deleted. Reload before trying again.",
    });
    act(() => test.result.current.remove());
    await settle();
    act(() => test.notices[0].undo?.());
    await settle();
    expect(test.notices.at(-1)).toEqual({
      title:
        "Subtitle changed since it was deleted. Reload before trying again.",
      type: "error",
    });
  });

  it("says why when ⌘Z cannot undo the video's last change", async () => {
    const test = setup({
      undoableAt: 5,
      undoFails: "Finish the current edit, then undo.",
    });
    act(() => test.result.current.undo());
    await settle();
    expect(test.notices).toEqual([
      { title: "Finish the current edit, then undo.", type: "error" },
    ]);
  });
});
