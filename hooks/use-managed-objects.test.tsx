import { describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { SidecarError } from "@/lib/studio/sidecar";
import type { PreviewMessage } from "@/preview/protocol";
import {
  applyStudioOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import {
  documentFixture,
  easingDocumentFixture,
} from "@/test/fixtures/studio-document";
import { previewControl } from "@/test/preview-channel";
import { useManagedObjects } from "./use-managed-objects";

function setup(
  document = documentFixture,
  removal: { fails?: string; held?: Promise<void> } = {}
) {
  const { preview, surface } = previewControl({ composition: "intro" });
  let saved: StudioSnapshot = {
    document: structuredClone(document),
    revision: "initial",
  };
  const read = mock(() => Effect.succeed(saved));
  const write = mock(
    (
      params: Parameters<
        NonNullable<Parameters<typeof useManagedObjects>[0]["write"]>
      >[0]
    ) =>
      Effect.try({
        catch: (cause) => new SidecarError({ message: String(cause) }),
        try: () => {
          saved = {
            document: applyStudioOperation(saved.document, params.operation),
            revision: params.operation.id,
          };
          return saved;
        },
      })
  );
  const removeObject = mock(
    (
      params: Parameters<
        NonNullable<Parameters<typeof useManagedObjects>[0]["removeObject"]>
      >[0]
    ) =>
      Effect.tryPromise({
        catch: (cause) =>
          new SidecarError({
            message: cause instanceof Error ? cause.message : String(cause),
          }),
        try: async () => {
          await removal.held;
          if (removal.fails) {
            throw new Error(removal.fails);
          }
          saved = {
            document: applyStudioOperation(saved.document, params.operation),
            revision: params.operation.id,
          };
          return { ...saved, upgraded: "src/videos/intro/index.tsx" };
        },
      })
  );
  const emit = (message: PreviewMessage) => act(() => surface.emit(message));
  const hook = renderHook(
    ({ projectId }) =>
      useManagedObjects({
        armed: true,
        enabled: true,
        preview,
        projectId,
        read,
        removeObject,
        write,
      }),
    { initialProps: { projectId: "project-one" } }
  );
  return {
    ...hook,
    emit,
    externalSize: (size: number) => {
      saved = {
        ...saved,
        document: {
          ...saved.document,
          objects: saved.document.objects.map((object) =>
            object.id === "third"
              ? { ...object, values: { ...object.values, size } }
              : object
          ),
        },
      };
    },
    preview,
    read,
    ready: () =>
      emit({
        generation: "generation-1",
        lastOperationId: null,
        type: "studio.ready",
        video: "intro",
      }),
    removeObject,
    saved: () => saved,
    sent: surface.sent,
    write,
  };
}

describe("managed inspector", () => {
  it("loads unmounted objects, saves a selected instance across a selection switch and undoes it", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    act(() => test.result.current.change("size", 72));
    expect(test.result.current.pending).toBe(1);
    act(() => {
      test.result.current.select("first");
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.saved().document.objects[2].values.size).toBe(72);
    expect(test.saved().document.objects[0].values.size).toBe(48);
    expect(test.result.current.selected?.id).toBe("first");
    act(() => {
      test.result.current.undo();
    });
    await waitFor(() =>
      expect(test.saved().document.objects[2].values.size).toBe(48)
    );
  });

  it("keeps selection across rebuilds and ignores old generations and other videos", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    test.emit({ type: "rebuilt" });
    test.emit({
      generation: "generation-2",
      lastOperationId: null,
      type: "studio.ready",
      video: "intro",
    });
    await waitFor(() => expect(test.result.current.loading).toBe(false));
    test.emit({
      generation: "generation-1",
      objectId: "first",
      type: "studio.select",
      video: "intro",
    });
    test.emit({
      generation: "generation-2",
      objectId: "first",
      type: "studio.select",
      video: "other",
    });
    expect(test.result.current.selected?.id).toBe("third");
    expect(test.result.current.isOpen).toBe(true);
  });

  it("retains conflicting drafts, blocks completion, and does not overwrite the external value", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    act(() => test.result.current.change("size", 72));
    test.externalSize(90);
    act(() => test.result.current.commit());
    await waitFor(() =>
      expect(test.result.current.error).toContain("changed elsewhere")
    );
    expect(test.result.current.pending).toBe(1);
    expect(test.saved().document.objects[2].values.size).toBe(90);
    act(() => test.result.current.discard());
    await waitFor(() => expect(test.result.current.pending).toBe(0));
  });

  it("does not send a stale read into the newly selected project's inspector", async () => {
    const test = setup();
    test.ready();
    test.rerender({ projectId: "project-two" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(test.result.current.objects).toHaveLength(0);
    expect(test.result.current.selected).toBeNull();
  });
  it("serializes overlapping commits and keeps the latest saved snapshot", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = test.write.getMockImplementation();
    if (!original) {
      throw new Error("Missing writer");
    }
    test.write.mockImplementationOnce((params) =>
      Effect.promise(() => gate).pipe(Effect.flatMap(() => original(params)))
    );
    act(() => {
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    act(() => {
      test.result.current.change("text", "Changed");
      test.result.current.commit();
    });
    expect(test.write).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await gate;
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.result.current.selected?.values).toEqual({
      size: 72,
      text: "Changed",
    });
    expect(test.write).toHaveBeenCalledTimes(2);
  });

  it("retries an uncertain save with the same receipt and immutable contents", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    const original = test.write.getMockImplementation();
    if (!original) {
      throw new Error("Missing writer");
    }
    test.write.mockImplementationOnce((params) =>
      original(params).pipe(
        Effect.flatMap(() =>
          Effect.fail(new SidecarError({ message: "Reply lost" }))
        )
      )
    );
    act(() => {
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    await waitFor(() =>
      expect(test.result.current.error).toContain("Reply lost")
    );
    act(() => test.result.current.change("size", 90));
    expect(
      test.result.current.fields.find((field) => field.id === "size")?.value
    ).toBe(72);
    act(() => test.result.current.retry());
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.saved().document.operations).toHaveLength(1);
    expect(test.saved().document.objects[2].values.size).toBe(72);
  });

  it("rejects incomplete numeric input without replacing it with zero", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => {
      test.result.current.select("third");
      test.result.current.change("size", "");
      test.result.current.commit();
    });
    expect(test.result.current.pending).toBe(1);
    expect(test.result.current.error).toContain("finite number");
    expect(test.write).not.toHaveBeenCalled();
    act(() => test.result.current.close());
    expect(test.result.current.isOpen).toBe(false);
  });
  it("blocks export until the rebuilt runtime acknowledges the saved operation", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => {
      test.result.current.select("third");
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.result.current.awaitingPreview).toBe(true);
    test.ready();
    await waitFor(() => expect(test.result.current.loading).toBe(false));
    expect(test.result.current.awaitingPreview).toBe(true);
    test.emit({
      generation: "rebuilt",
      lastOperationId: test.saved().document.operations.at(-1)?.id ?? null,
      type: "studio.ready",
      video: "intro",
    });
    await waitFor(() =>
      expect(test.result.current.awaitingPreview).toBe(false)
    );
  });
});

it("drops equal curve drafts and saves and undoes the entire custom curve", async () => {
  const test = setup(easingDocumentFixture);
  test.ready();
  await waitFor(() => expect(test.result.current.objects).toHaveLength(1));
  act(() => test.result.current.select("title"));
  act(() => test.result.current.change("entryEasing", [0, 0, 0.58, 1]));
  expect(test.result.current.pending).toBe(0);
  act(() => test.result.current.change("entryEasing", [0.2, -0.5, 0.8, 1.4]));
  act(() => test.result.current.commit());
  await waitFor(() => expect(test.result.current.pending).toBe(0));
  expect(test.saved().document.objects[0].values.entryEasing).toEqual([
    0.2, -0.5, 0.8, 1.4,
  ]);
  act(() => {
    test.result.current.undo();
  });
  await waitFor(() =>
    expect(test.saved().document.objects[0].values.entryEasing).toEqual([
      0, 0, 0.58, 1,
    ])
  );
});

describe("deleting an object", () => {
  const grouped = {
    ...documentFixture,
    objects: documentFixture.objects.map((item) =>
      item.id === "third" ? { ...item, parentId: "second" } : item
    ),
  };
  const sent = (test: ReturnType<typeof setup>) => test.sent;

  it("hides the object and its children before the write resolves, then drops them from the list", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const test = setup(grouped, { held });
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("second"));
    let removed: Promise<unknown> = Promise.resolve();
    act(() => {
      removed = test.result.current.remove("second");
    });
    expect(
      sent(test).find((command) => command.type === "studio.hide")
    ).toMatchObject({
      selectors: [
        '[data-studio-object="second"]',
        '[data-studio-object="third"]',
      ],
    });
    expect(test.result.current.selected).toBeNull();
    expect(test.result.current.isOpen).toBe(false);
    expect(test.saved().document.operations).toHaveLength(0);
    release();
    await act(() => removed);
    expect(await removed).toMatchObject({
      label: "second",
      ok: true,
      upgraded: "src/videos/intro/index.tsx",
    });
    expect(test.result.current.objects.map((item) => item.id)).toEqual([
      "first",
    ]);
  });

  it("brings the object back, selected, when the write is refused", async () => {
    const test = setup(documentFixture, { fails: "The video changed." });
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("first"));
    let removed: Promise<unknown> = Promise.resolve();
    act(() => {
      removed = test.result.current.remove("first");
    });
    await act(() => removed);
    expect(await removed).toEqual({ error: "The video changed.", ok: false });
    const hide = sent(test).find((command) => command.type === "studio.hide");
    const unhide = sent(test).find(
      (command) => command.type === "studio.unhide"
    );
    expect(unhide?.token).toBe(hide?.token);
    expect(test.result.current.selected?.id).toBe("first");
    expect(test.result.current.error).toBe("The video changed.");
  });

  it("undoes the removal, restores the object and selects it again", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    await act(() => test.result.current.remove("first"));
    expect(test.result.current.objects).toHaveLength(2);
    expect(test.result.current.undoableAt).toBeGreaterThan(0);
    act(() => {
      test.result.current.undo();
    });
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    expect(test.saved().document.objects[0].removed).toBeUndefined();
    expect(test.result.current.selected?.id).toBe("first");
  });

  it("says why when an undo can no longer apply", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    await act(() => test.result.current.remove("first"));
    const [removal] = test.saved().document.operations;
    await act(() =>
      Effect.runPromise(
        test.write({
          operation: {
            id: "restored-elsewhere",
            kind: "restore",
            objectId: "first",
            undoOf: removal.id,
          },
          projectId: "project-one",
          video: "intro",
        })
      )
    );
    act(() => {
      test.result.current.undoOperation({ ...removal, id: "other" });
    });
    await waitFor(() =>
      expect(test.result.current.error).toContain(
        "changed since it was deleted"
      )
    );
  });

  it("keeps the current selection when another object is deleted from its row", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    await act(() => test.result.current.remove("first"));
    expect(test.result.current.selected?.id).toBe("third");
    expect(test.result.current.isOpen).toBe(true);
  });

  it("refuses the notice's Undo from another video, and says an undone change is undone", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    await act(() => test.result.current.remove("first"));
    const [removal] = test.saved().document.operations;
    expect(
      await test.result.current.undoOperation(removal, {
        projectId: "project-one",
        video: "outro",
      })
    ).toBe("Open the video it was deleted from to undo this.");
    let first: string | null = "pending";
    await act(async () => {
      first = await test.result.current.undoOperation(removal, {
        projectId: "project-one",
        video: "intro",
      });
    });
    expect(first).toBeNull();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    expect(await test.result.current.undoOperation(removal)).toBe(
      "This change was already undone."
    );
  });

  it("refuses a scene and leaves everything as it was", async () => {
    const test = setup({
      ...documentFixture,
      definitions: [
        ...documentFixture.definitions,
        { fields: [], id: "scene", version: 1 },
      ],
      objects: [
        {
          definition: "scene",
          id: "opening",
          label: "Opening",
          parentId: null,
          values: {},
        },
        ...documentFixture.objects,
      ],
    });
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(4));
    expect(await test.result.current.remove("opening")).toBeNull();
    expect(test.removeObject).not.toHaveBeenCalled();
  });
});

it("edits an ordered shader palette independently and resets all changed defaults in one undoable operation", async () => {
  const { MESH_GRADIENT, shaderCreation } = await import("@/shared/shaders");
  const { shaderTargetFixture } = await import("@/test/fixtures/shaders");
  const first = shaderCreation(
    MESH_GRADIENT,
    shaderTargetFixture,
    "insert-first",
    "shader-first",
    0
  );
  const second = shaderCreation(
    MESH_GRADIENT,
    shaderTargetFixture,
    "insert-second",
    "shader-second",
    1
  );
  const data = applyStudioOperation(
    applyStudioOperation(documentFixture, first, shaderTargetFixture),
    second,
    shaderTargetFixture
  );
  const test = setup(data);
  test.ready();
  await waitFor(() => expect(test.result.current.objects).toHaveLength(5));
  act(() => test.result.current.select("shader-first"));
  const colors = ["#ff0000", "#ff0000", "#0000ff80"];
  act(() => {
    test.result.current.change("colors", colors);
    test.result.current.commit();
  });
  await waitFor(() => expect(test.result.current.pending).toBe(0));
  expect(
    test.saved().document.objects.find((object) => object.id === "shader-first")
      ?.values.colors
  ).toEqual(colors);
  expect(
    test
      .saved()
      .document.objects.find((object) => object.id === "shader-second")?.values
      .colors
  ).toEqual(second.object.values.colors);
  act(() => {
    test.result.current.change("distortion", 0.9);
    test.result.current.commit();
  });
  await waitFor(() => expect(test.result.current.pending).toBe(0));
  const before = test.saved().document.operations.length;
  act(() => test.result.current.resetShader());
  await waitFor(() => expect(test.result.current.pending).toBe(0));
  expect(test.saved().document.operations).toHaveLength(before + 1);
  expect(
    test.saved().document.objects.find((object) => object.id === "shader-first")
      ?.values
  ).toEqual(first.object.values);
  act(() => {
    test.result.current.undo();
  });
  await waitFor(() =>
    expect(
      test
        .saved()
        .document.objects.find((object) => object.id === "shader-first")?.values
        .colors
    ).toEqual(colors)
  );
  expect(
    test.saved().document.objects.find((object) => object.id === "shader-first")
      ?.values.distortion
  ).toBe(0.9);
});
