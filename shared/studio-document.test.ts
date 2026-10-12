import { describe, expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import {
  documentFixture,
  easingDocumentFixture,
  operationFixture,
} from "@/test/fixtures/studio-document";
import { MESH_GRADIENT, shaderCreation } from "./shaders";
import {
  applyStudioOperation,
  inverseStudioOperation,
  isRemoved,
  removedIds,
  StudioDocument,
  sameStudioValue,
} from "./studio-document";

const decode = Schema.decodeUnknownExit(StudioDocument);

describe("shader palette and creation", () => {
  const creation = shaderCreation(
    MESH_GRADIENT,
    shaderTargetFixture,
    "insert-1",
    "shader-1",
    0
  );
  const create = () =>
    applyStudioOperation(documentFixture, creation, shaderTargetFixture);
  const paletteEdit = {
    after: ["#ff0000", "#00000000", "#ff0000"],
    before: creation.object.values.colors,
    definition: creation.definition,
    field: "colors",
    id: "colors-1",
    objectId: creation.objectId,
  };

  it("preserves duplicates and palette order across save and Undo", () => {
    const saved = applyStudioOperation(create(), paletteEdit);
    expect(Exit.isSuccess(decode(JSON.parse(JSON.stringify(saved))))).toBe(
      true
    );
    expect(saved.objects.at(-1)?.values.colors).toEqual(paletteEdit.after);
    expect(sameStudioValue(paletteEdit.after, [...paletteEdit.after])).toBe(
      true
    );
    expect(
      sameStudioValue(["#000000", "#ffffff"], ["#ffffff", "#000000"])
    ).toBe(false);
    const undone = applyStudioOperation(
      saved,
      inverseStudioOperation(paletteEdit, "undo-colors")
    );
    expect(undone.objects.at(-1)?.values.colors).toEqual(
      creation.object.values.colors
    );
  });

  it("rejects empty, oversized, mixed and invalid palettes and enforces per-shader limits", () => {
    for (const colors of [
      [],
      new Array(11).fill("#000000"),
      ["red"],
      ["#fff"],
      [1, 2, 3, 4],
      ["#000000", 1],
    ]) {
      const current = create();
      const objects = current.objects.map((object) =>
        object.id === creation.objectId
          ? { ...object, values: { ...object.values, colors } }
          : object
      );
      expect(Exit.isFailure(decode({ ...current, objects }))).toBe(true);
    }
    const definition = {
      ...creation.definition,
      fields: creation.definition.fields.map((field) =>
        field.id === "colors" ? { ...field, maxItems: 2 } : field
      ),
    };
    expect(
      Exit.isFailure(
        decode({
          ...create(),
          definitions: [...documentFixture.definitions, definition],
        })
      )
    ).toBe(true);
    expect(Exit.isSuccess(decode(documentFixture))).toBe(true);
  });

  it("retries a committed creation after edits without replacing the live object", () => {
    const edited = applyStudioOperation(create(), paletteEdit);
    expect(
      applyStudioOperation(edited, JSON.parse(JSON.stringify(creation)))
    ).toBe(edited);
    const reordered = {
      ...creation,
      object: {
        ...creation.object,
        values: Object.fromEntries(
          Object.entries(creation.object.values).reverse()
        ),
      },
    };
    expect(applyStudioOperation(edited, reordered)).toBe(edited);
    for (const changed of [
      { ...creation, target: { ...creation.target, generation: "new-build" } },
      { ...creation, object: { ...creation.object, label: "Another shader" } },
      {
        ...creation,
        object: {
          ...creation.object,
          values: { ...creation.object.values, opacity: 0.5 },
        },
      },
      {
        ...creation,
        object: {
          ...creation.object,
          shader: {
            revision: "new-revision",
            slotId: shaderTargetFixture.slotId,
            slug: MESH_GRADIENT.slug,
          },
        },
      },
      { ...creation, definition: { ...creation.definition, version: 2 } },
    ]) {
      expect(() =>
        applyStudioOperation(edited, changed, shaderTargetFixture)
      ).toThrow("different change");
    }
  });

  it("rejects unverified and stale targets, reused object IDs, mismatched definitions and missing scenes", () => {
    expect(() => applyStudioOperation(documentFixture, creation)).toThrow(
      "target changed"
    );
    expect(() =>
      applyStudioOperation(documentFixture, creation, {
        ...shaderTargetFixture,
        generation: "new",
      })
    ).toThrow("target changed");
    expect(() =>
      applyStudioOperation(
        create(),
        { ...creation, id: "insert-again" },
        shaderTargetFixture
      )
    ).toThrow("reserved");
    expect(() =>
      applyStudioOperation(
        {
          ...documentFixture,
          definitions: [
            ...documentFixture.definitions,
            { ...creation.definition, version: 2 },
          ],
        },
        creation,
        shaderTargetFixture
      )
    ).toThrow("properties changed");
    const target = { ...shaderTargetFixture, sceneId: "missing" };
    expect(() =>
      applyStudioOperation(
        documentFixture,
        shaderCreation(MESH_GRADIENT, target, "missing", "shader-2", 0),
        target
      )
    ).toThrow("scene is no longer");
  });

  it("undoes creation without losing another instance and reserves its ID for restore", () => {
    const second = shaderCreation(
      MESH_GRADIENT,
      shaderTargetFixture,
      "insert-2",
      "shader-2",
      1
    );
    const both = applyStudioOperation(create(), second, shaderTargetFixture);
    const inverse = inverseStudioOperation(creation, "undo-insert");
    const undone = applyStudioOperation(both, inverse);
    expect(isRemoved(undone.objects, "shader-1")).toBe(true);
    expect(isRemoved(undone.objects, "shader-2")).toBe(false);
    expect(undone.definitions).toEqual(both.definitions);
    expect(applyStudioOperation(undone, inverse)).toBe(undone);
    const restored = applyStudioOperation(
      undone,
      inverseStudioOperation(inverse, "redo-insert")
    );
    expect(restored.objects).toEqual(both.objects);
    expect(Exit.isSuccess(decode(restored))).toBe(true);
  });

  it("refuses Undo after external edits or schema changes and rejects unchecked inverses", () => {
    const inverse = inverseStudioOperation(creation, "undo-insert");
    expect(() =>
      applyStudioOperation(applyStudioOperation(create(), paletteEdit), inverse)
    ).toThrow("changed elsewhere");
    expect(() =>
      applyStudioOperation(
        {
          ...create(),
          definitions: [
            ...documentFixture.definitions,
            { ...creation.definition, version: 2 },
          ],
        },
        inverse
      )
    ).toThrow("properties changed");
    expect(() =>
      applyStudioOperation(create(), {
        id: "unchecked",
        kind: "remove",
        objectId: creation.objectId,
        undoOf: creation.id,
      })
    ).toThrow("original object");
    expect(() =>
      applyStudioOperation(create(), {
        ...paletteEdit,
        after: 2,
        before: 0,
        changes: [
          { after: false, before: true, field: "followSceneEnd" },
          { after: 1, before: 150, field: "endFrame" },
        ],
        field: "startFrame",
      })
    ).toThrow("timing");
  });
});

describe("managed object contract", () => {
  it("edits one repeated instance after reorder, keeps independent edits and undoes only its own field", () => {
    const first = applyStudioOperation(documentFixture, operationFixture());
    const other = applyStudioOperation(
      { ...first, objects: [...first.objects].reverse() },
      operationFixture({ after: 90, id: "edit-2", objectId: "first" })
    );
    const undone = applyStudioOperation(
      other,
      inverseStudioOperation(operationFixture(), "undo-1")
    );
    expect(
      undone.objects.find((item) => item.id === "third")?.values.size
    ).toBe(48);
    expect(
      undone.objects.find((item) => item.id === "first")?.values.size
    ).toBe(90);
    expect(documentFixture.objects[2].values.size).toBe(48);
  });

  it("retries idempotently even after another edit and refuses reusing an operation ID", () => {
    const first = applyStudioOperation(documentFixture, operationFixture());
    const second = applyStudioOperation(
      first,
      operationFixture({ after: 80, before: 72, id: "second" })
    );
    expect(applyStudioOperation(second, operationFixture())).toBe(second);
    expect(() =>
      applyStudioOperation(second, operationFixture({ after: 90 }))
    ).toThrow("different change");
  });

  it("refuses stale writes, stale Undo, deleted objects and changed schemas", () => {
    const changed = applyStudioOperation(documentFixture, operationFixture());
    expect(() =>
      applyStudioOperation(changed, operationFixture({ id: "stale" }))
    ).toThrow("changed elsewhere");
    const newer = applyStudioOperation(
      changed,
      operationFixture({ after: 90, before: 72, id: "newer" })
    );
    expect(() =>
      applyStudioOperation(
        newer,
        inverseStudioOperation(operationFixture(), "undo")
      )
    ).toThrow("changed elsewhere");
    expect(() =>
      applyStudioOperation(
        { ...documentFixture, objects: [] },
        operationFixture()
      )
    ).toThrow("removed");
    expect(() =>
      applyStudioOperation(
        documentFixture,
        operationFixture({
          definition: { ...documentFixture.definitions[0], version: 2 },
        })
      )
    ).toThrow("properties changed");
  });

  it("validates IDs, parents, values, supported versions and explicit defaults", () => {
    expect(Exit.isSuccess(decode(documentFixture))).toBe(true);
    for (const invalid of [
      { ...documentFixture, version: 2 },
      {
        ...documentFixture,
        objects: [...documentFixture.objects, documentFixture.objects[0]],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], parentId: "first" }],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], parentId: "missing" }],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], values: { size: 48 } }],
      },
      {
        ...documentFixture,
        objects: [
          { ...documentFixture.objects[0], values: { size: 400, text: "" } },
        ],
      },
      {
        ...documentFixture,
        objects: [
          {
            ...documentFixture.objects[0],
            values: { size: Number.NaN, text: "" },
          },
        ],
      },
    ]) {
      expect(Exit.isFailure(decode(invalid))).toBe(true);
    }
    expect(() =>
      applyStudioOperation(documentFixture, operationFixture({ after: 0 }))
    ).toThrow("at least");
    expect(() =>
      applyStudioOperation(documentFixture, operationFixture({ after: "72" }))
    ).toThrow("number");
  });
});

describe("removing an object", () => {
  const grouped: StudioDocument = {
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
      ...documentFixture.objects.map((item) =>
        item.id === "third" ? { ...item, parentId: "second" } : item
      ),
    ],
  };
  const remove = (objectId: string, id = `remove-${objectId}`) =>
    ({ id, kind: "remove", objectId }) as const;

  it("marks the record and keeps its values and place", () => {
    const removed = applyStudioOperation(grouped, remove("first"));
    const index = removed.objects.findIndex((item) => item.id === "first");
    expect(index).toBe(1);
    expect(removed.objects[index]).toEqual({
      ...grouped.objects[1],
      removed: true,
    });
    expect(removed.operations).toHaveLength(1);
    expect(Exit.isSuccess(decode(removed))).toBe(true);
  });

  it("restores exactly what was removed", () => {
    const removed = applyStudioOperation(grouped, remove("first"));
    const restored = applyStudioOperation(
      removed,
      inverseStudioOperation(remove("first"), "undo")
    );
    expect(restored.objects).toEqual(grouped.objects);
  });

  it("removes descendants with their group", () => {
    const removed = applyStudioOperation(grouped, remove("second"));
    expect(isRemoved(removed.objects, "third")).toBe(true);
    expect([...removedIds(removed.objects)].sort()).toEqual([
      "second",
      "third",
    ]);
    expect(() => applyStudioOperation(removed, remove("third"))).toThrow(
      "already deleted"
    );
  });

  it("refuses a scene, a second removal and an unknown object", () => {
    expect(() => applyStudioOperation(grouped, remove("opening"))).toThrow(
      "A scene cannot be deleted"
    );
    const removed = applyStudioOperation(grouped, remove("first"));
    expect(() =>
      applyStudioOperation(removed, remove("first", "again"))
    ).toThrow("already deleted");
    expect(() => applyStudioOperation(grouped, remove("missing"))).toThrow(
      "no longer in the video"
    );
  });

  it("refuses a restore once the object is back", () => {
    const removed = applyStudioOperation(grouped, remove("first"));
    const restored = applyStudioOperation(
      removed,
      inverseStudioOperation(remove("first"), "undo")
    );
    expect(() =>
      applyStudioOperation(
        restored,
        inverseStudioOperation(remove("first"), "undo-again")
      )
    ).toThrow("changed since it was deleted");
  });

  it("refuses editing a removed object or one under a removed group", () => {
    const removed = applyStudioOperation(grouped, remove("second"));
    expect(() =>
      applyStudioOperation(removed, operationFixture({ objectId: "second" }))
    ).toThrow("was deleted");
    expect(() => applyStudioOperation(removed, operationFixture())).toThrow(
      "was deleted"
    );
  });

  it("retries once and refuses reusing the ID for another change", () => {
    const removed = applyStudioOperation(grouped, remove("first"));
    expect(applyStudioOperation(removed, remove("first"))).toBe(removed);
    expect(() =>
      applyStudioOperation(removed, remove("second", "remove-first"))
    ).toThrow("different change");
    expect(() =>
      applyStudioOperation(removed, operationFixture({ id: "remove-first" }))
    ).toThrow("different change");
  });
});

it("validates Bezier domains and permits overshoot", () => {
  const doc = structuredClone(easingDocumentFixture);
  expect(Exit.isSuccess(decode(doc))).toBe(true);
  const overshoot = {
    ...doc,
    objects: [
      { ...doc.objects[0], values: { entryEasing: [0.2, -1, 0.8, 2] } },
    ],
  };
  expect(Exit.isSuccess(decode(overshoot))).toBe(true);
  for (const value of [
    [-0.1, 0, 1, 1],
    [0, 0, 1.1, 1],
    [0, Number.POSITIVE_INFINITY, 1, 1],
    [0, 0, 1],
    "easeOut",
  ]) {
    expect(
      Exit.isFailure(
        decode({
          ...doc,
          objects: [{ ...doc.objects[0], values: { entryEasing: value } }],
        })
      )
    ).toBe(true);
  }
});

it("compares curves by coordinates across serialization, retries and checked Undo", () => {
  const doc = easingDocumentFixture;
  const operation = {
    after: [0.25, -0.3, 0.8, 1.4] as const,
    before: [0, 0, 0.58, 1] as const,
    definition: structuredClone(doc.definitions[0]),
    field: "entryEasing",
    id: "curve",
    objectId: "title",
  };
  const saved = applyStudioOperation(doc, operation);
  expect(applyStudioOperation(saved, structuredClone(operation))).toBe(saved);
  const undone = applyStudioOperation(
    saved,
    inverseStudioOperation(structuredClone(operation), "undo")
  );
  expect(undone.objects[0].values.entryEasing).toEqual(operation.before);
  expect(() =>
    applyStudioOperation(saved, { ...operation, id: "stale" })
  ).toThrow("changed elsewhere");
  expect(() =>
    applyStudioOperation(saved, { ...operation, after: [0, 0, 1, 1] })
  ).toThrow("different change");
});
