import type {StudioDocument, StudioFieldOperation} from "@/shared/studio-document";

export const documentFixture: StudioDocument = {
  definitions: [
    {
      fields: [
        { default: "", id: "text", label: "Text", type: "text" },
        {
          default: 48,
          id: "size",
          label: "Size",
          max: 300,
          min: 1,
          type: "number",
        },
      ],
      id: "heading",
      version: 1,
    },
  ],
  objects: ["first", "second", "third"].map((id) => ({
    definition: "heading",
    id,
    label: id,
    parentId: null,
    values: { size: 48, text: id },
  })),
  operations: [],
  version: 1,
  video: "intro",
};

export function operationFixture(
  patch: Partial<StudioFieldOperation> = {}
): StudioFieldOperation {
  return {
    after: 72,
    before: 48,
    definition: documentFixture.definitions[0],
    field: "size",
    id: "edit-1",
    objectId: "third",
    ...patch,
  };
}


export const easingDocumentFixture = {
  version: 1, video: "intro", operations: [],
  definitions: [{ id: "motion", version: 1, fields: [{id: "entryEasing", label: "Entry easing", type: "easing", default: [0, 0, 0.58, 1]}] }],
  objects: [{id: "title", label: "Title", definition: "motion", parentId: null, values: {entryEasing: [0, 0, 0.58, 1]}}],
} satisfies StudioDocument;
