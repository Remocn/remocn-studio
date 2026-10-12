import { Schema } from "effect";
import {
  ShaderIdentity,
  ShaderTarget,
  sameShaderTarget,
} from "./shader-target";

const HEX_COLOR = /^#[\da-f]{6}([\da-f]{2})?$/i;

const Identifier = Schema.NonEmptyString.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
);

const BezierX = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 })
);
export const StudioBezier = Schema.Tuple([
  BezierX,
  Schema.Finite,
  BezierX,
  Schema.Finite,
]);
export type StudioBezier = typeof StudioBezier.Type;
export const isStudioBezier = Schema.is(StudioBezier);

export const StudioPalette = Schema.Array(
  Schema.String.check(Schema.isPattern(HEX_COLOR))
).check(Schema.isMinLength(1), Schema.isMaxLength(10));
export type StudioPalette = typeof StudioPalette.Type;
export const isStudioPalette = Schema.is(StudioPalette);

export const StudioValue = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  StudioBezier,
  StudioPalette,
]);
export type StudioValue = typeof StudioValue.Type;

export const StudioFieldCondition = Schema.Struct({
  field: Identifier,
  operator: Schema.Literals(["equals", "greaterThan", "lengthAtLeast"]),
  reason: Schema.NonEmptyString,
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]),
});

export const StudioField = Schema.Struct({
  availableWhen: Schema.optionalKey(StudioFieldCondition),
  default: StudioValue,
  group: Schema.optionalKey(Schema.String),
  id: Identifier,
  integer: Schema.optionalKey(Schema.Literal(true)),
  label: Schema.NonEmptyString,
  max: Schema.optionalKey(Schema.Finite),
  maxItems: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ maximum: 10, minimum: 1 }))
  ),
  min: Schema.optionalKey(Schema.Finite),
  minItems: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ maximum: 10, minimum: 1 }))
  ),
  options: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  step: Schema.optionalKey(Schema.Finite),
  type: Schema.Literals([
    "number",
    "text",
    "color",
    "boolean",
    "enum",
    "easing",
    "palette",
  ]),
  unit: Schema.optionalKey(Schema.String),
});
export type StudioField = typeof StudioField.Type;

export const StudioDefinition = Schema.Struct({
  fields: Schema.Array(StudioField),
  id: Identifier,
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});
export type StudioDefinition = typeof StudioDefinition.Type;

export const SCENE_DEFINITION = "scene";

export const StudioObject = Schema.Struct({
  definition: Identifier,
  id: Identifier,
  label: Schema.NonEmptyString,
  parentId: Schema.NullOr(Identifier),
  removed: Schema.optionalKey(Schema.Literal(true)),
  shader: Schema.optionalKey(ShaderIdentity),
  values: Schema.Record(Identifier, StudioValue),
});
export type StudioObject = typeof StudioObject.Type;

export const StudioFieldChange = Schema.Struct({
  after: StudioValue,
  before: StudioValue,
  field: Identifier,
});
export type StudioFieldChange = typeof StudioFieldChange.Type;

export const StudioFieldOperation = Schema.Struct({
  ...StudioFieldChange.fields,
  changes: Schema.optionalKey(Schema.Array(StudioFieldChange)),
  definition: StudioDefinition,
  id: Schema.NonEmptyString,
  objectId: Identifier,
  undoOf: Schema.optionalKey(Schema.NonEmptyString),
}).check(
  Schema.makeFilter((operation) => {
    const fields = [
      operation.field,
      ...(operation.changes ?? []).map((item) => item.field),
    ];
    return (
      new Set(fields).size === fields.length ||
      "An edit cannot change the same field twice."
    );
  })
);
export type StudioFieldOperation = typeof StudioFieldOperation.Type;

export const StudioObjectOperation = Schema.Struct({
  expected: Schema.optionalKey(StudioObject),
  expectedDefinition: Schema.optionalKey(StudioDefinition),
  id: Schema.NonEmptyString,
  kind: Schema.Literals(["remove", "restore"]),
  objectId: Identifier,
  undoOf: Schema.optionalKey(Schema.NonEmptyString),
});
export type StudioObjectOperation = typeof StudioObjectOperation.Type;

export const StudioCreateOperation = Schema.Struct({
  definition: StudioDefinition,
  id: Schema.NonEmptyString,
  kind: Schema.Literal("create"),
  object: StudioObject,
  objectId: Identifier,
  target: ShaderTarget,
  undoOf: Schema.optionalKey(Schema.Never),
}).check(
  Schema.makeFilter(
    (operation) =>
      (operation.objectId === operation.object.id &&
        operation.object.definition === operation.definition.id &&
        operation.object.shader?.slotId === operation.target.slotId &&
        operation.object.parentId === operation.target.sceneId &&
        operation.object.removed !== true) ||
      "Creation needs a complete active shader object bound to its target."
  )
);
export type StudioCreateOperation = typeof StudioCreateOperation.Type;

export const StudioOperation = Schema.Union([
  StudioFieldOperation,
  StudioObjectOperation,
  StudioCreateOperation,
]);
export type StudioOperation = typeof StudioOperation.Type;

export function isObjectOperation(
  operation: StudioOperation
): operation is StudioObjectOperation | StudioCreateOperation {
  return "kind" in operation;
}

export function isCreationOperation(
  operation: StudioOperation
): operation is StudioCreateOperation {
  return "kind" in operation && operation.kind === "create";
}

export function isRemoved(
  objects: readonly StudioObject[],
  id: string
): boolean {
  const byId = new Map(objects.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let current = byId.get(id);
  while (current !== undefined && !visited.has(current.id)) {
    if (current.removed === true) {
      return true;
    }
    visited.add(current.id);
    current =
      current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

export function removedIds(
  objects: readonly StudioObject[]
): ReadonlySet<string> {
  return new Set(
    objects.filter((item) => isRemoved(objects, item.id)).map((item) => item.id)
  );
}

export const StudioDocument = Schema.Struct({
  definitions: Schema.Array(StudioDefinition),
  objects: Schema.Array(StudioObject),
  operations: Schema.Array(StudioOperation),
  version: Schema.Literal(1),
  video: Identifier,
}).check(Schema.makeFilter((document) => documentProblem(document) ?? true));
export type StudioDocument = typeof StudioDocument.Type;

export const StudioDocumentRef = Schema.Struct({
  projectId: Schema.NonEmptyString,
  video: Identifier,
});
export const StudioSnapshot = Schema.Struct({
  document: StudioDocument,
  revision: Schema.NonEmptyString,
});
export type StudioSnapshot = typeof StudioSnapshot.Type;

export function fieldProblem(
  field: StudioField,
  value: StudioValue
): string | null {
  if (field.type === "palette") {
    return paletteProblem(field, value);
  }
  if (field.type === "easing") {
    return isStudioBezier(value)
      ? null
      : `${field.label} needs four finite Bezier coordinates with X between 0 and 1.`;
  }
  if (field.type === "number") {
    return numberProblem(field, value);
  }
  if (field.type === "boolean") {
    return typeof value === "boolean"
      ? null
      : `${field.label} needs a switch value.`;
  }
  if (typeof value !== "string") {
    return `${field.label} needs text.`;
  }
  if (field.type === "enum" && !field.options?.includes(value)) {
    return `Choose one of the options for ${field.label}.`;
  }
  if (field.type === "color" && !HEX_COLOR.test(value)) {
    return `${field.label} needs a six- or eight-digit hex color.`;
  }
  return null;
}

interface DocumentShape {
  readonly definitions: readonly StudioDefinition[];
  readonly objects: readonly StudioObject[];
  readonly operations: readonly StudioOperation[];
}

export function documentProblem(document: DocumentShape): string | null {
  const definitions = new Map(
    document.definitions.map((item) => [item.id, item])
  );
  const objects = new Map(document.objects.map((item) => [item.id, item]));
  if (
    definitions.size !== document.definitions.length ||
    objects.size !== document.objects.length
  ) {
    return "Each object and component definition needs a unique ID.";
  }
  if (
    new Set(document.operations.map((item) => item.id)).size !==
    document.operations.length
  ) {
    return "The edit history contains duplicate operation IDs.";
  }
  for (const definition of document.definitions) {
    const problem = definitionProblem(definition);
    if (problem !== null) {
      return problem;
    }
  }
  for (const object of document.objects) {
    const problem =
      objectProblem(object, definitions.get(object.definition)) ??
      parentProblem(object, objects);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

export function definitionProblem(definition: StudioDefinition): string | null {
  if (
    new Set(definition.fields.map((field) => field.id)).size !==
    definition.fields.length
  ) {
    return `${definition.id} declares the same property twice.`;
  }
  for (const field of definition.fields) {
    const problem =
      fieldMetadataProblem(field) ??
      conditionProblem(field, definition) ??
      fieldProblem(field, field.default);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

function objectProblem(
  object: StudioObject,
  definition: StudioDefinition | undefined
): string | null {
  if (definition === undefined) {
    return `${object.label} has no component definition.`;
  }
  if (object.shader) {
    const { startFrame, endFrame, followSceneEnd, order, opacity } =
      object.values;
    if (
      typeof startFrame !== "number" ||
      !Number.isInteger(startFrame) ||
      startFrame < 0 ||
      typeof endFrame !== "number" ||
      !Number.isInteger(endFrame) ||
      endFrame < 1 ||
      typeof followSceneEnd !== "boolean" ||
      (!followSceneEnd && endFrame <= startFrame) ||
      typeof order !== "number" ||
      !Number.isInteger(order) ||
      order < 0 ||
      typeof opacity !== "number" ||
      opacity < 0 ||
      opacity > 1
    ) {
      return `${object.label} has invalid shader timing or layer properties.`;
    }
  }
  if (Object.keys(object.values).length !== definition.fields.length) {
    return `${object.label} must store exactly its declared properties.`;
  }
  for (const field of definition.fields) {
    if (!Object.hasOwn(object.values, field.id)) {
      return `${object.label} is missing ${field.label}.`;
    }
    const problem = fieldProblem(field, object.values[field.id]);
    if (problem !== null) {
      return `${object.label}: ${problem}`;
    }
  }
  return null;
}

function parentProblem(
  object: StudioObject,
  objects: ReadonlyMap<string, StudioObject>
): string | null {
  const visited = new Set([object.id]);
  let parent = object.parentId;
  while (parent !== null) {
    if (visited.has(parent)) {
      return `${object.label} has a parent cycle.`;
    }
    visited.add(parent);
    const ancestor = objects.get(parent);
    if (ancestor === undefined) {
      return `${object.label} has a missing parent.`;
    }
    parent = ancestor.parentId;
  }
  return null;
}

export function sameDefinition(
  left: StudioDefinition,
  right: StudioDefinition
): boolean {
  return (
    JSON.stringify(definitionKey(left)) === JSON.stringify(definitionKey(right))
  );
}

function definitionKey(definition: StudioDefinition) {
  return [
    definition.id,
    definition.version,
    definition.fields.map((field) => [
      field.id,
      field.label,
      field.type,
      field.default,
      field.min,
      field.max,
      field.step,
      field.options,
      field.unit,
      field.group,
      field.integer,
      field.minItems,
      field.maxItems,
      field.availableWhen && [
        field.availableWhen.field,
        field.availableWhen.operator,
        field.availableWhen.value,
        field.availableWhen.reason,
      ],
    ]),
  ];
}

export function applyStudioOperation(
  document: StudioDocument,
  operation: StudioOperation,
  target?: ShaderTarget
): StudioDocument {
  const previous = document.operations.find((item) => item.id === operation.id);
  if (previous !== undefined) {
    if (!sameOperation(previous, operation)) {
      throw new Error(
        "This edit ID has already been used for a different change."
      );
    }
    return document;
  }
  if (isCreationOperation(operation)) {
    return applyCreation(document, operation, target);
  }
  return isObjectOperation(operation)
    ? applyObjectOperation(document, operation)
    : applyFieldOperation(document, operation);
}

function sameOperation(
  previous: StudioOperation,
  operation: StudioOperation
): boolean {
  if (isCreationOperation(previous) || isCreationOperation(operation)) {
    return (
      isCreationOperation(previous) &&
      isCreationOperation(operation) &&
      previous.objectId === operation.objectId &&
      sameStudioObject(previous.object, operation.object) &&
      sameDefinition(previous.definition, operation.definition) &&
      sameShaderTarget(previous.target, operation.target)
    );
  }
  if (isObjectOperation(previous) || isObjectOperation(operation)) {
    return (
      isObjectOperation(previous) &&
      isObjectOperation(operation) &&
      previous.kind === operation.kind &&
      previous.objectId === operation.objectId &&
      previous.undoOf === operation.undoOf &&
      sameOptionalObject(previous.expected, operation.expected) &&
      (previous.expectedDefinition === undefined
        ? operation.expectedDefinition === undefined
        : operation.expectedDefinition !== undefined &&
          sameDefinition(
            previous.expectedDefinition,
            operation.expectedDefinition
          ))
    );
  }
  return !(
    previous.objectId !== operation.objectId ||
    previous.field !== operation.field ||
    !sameStudioValue(previous.before, operation.before) ||
    !sameStudioValue(previous.after, operation.after) ||
    !sameChanges(previous, operation) ||
    previous.undoOf !== operation.undoOf ||
    !sameDefinition(previous.definition, operation.definition)
  );
}

function applyObjectOperation(
  document: StudioDocument,
  operation: StudioObjectOperation
): StudioDocument {
  const object = document.objects.find(
    (item) => item.id === operation.objectId
  );
  if (object === undefined) {
    throw new Error(
      "This object is no longer in the video. Reload and try again."
    );
  }
  if (operation.expected && !sameStudioObject(object, operation.expected)) {
    throw new Error(
      `${object.label} changed elsewhere. Reload before trying again.`
    );
  }
  const original = document.operations.find(
    (item) => item.id === operation.undoOf
  );
  if (
    original &&
    isCreationOperation(original) &&
    (operation.kind !== "remove" ||
      !operation.expected ||
      !operation.expectedDefinition ||
      !sameStudioObject(original.object, operation.expected) ||
      !sameDefinition(original.definition, operation.expectedDefinition))
  ) {
    throw new Error("Undo creation needs the original object and definition.");
  }
  if (operation.expectedDefinition) {
    const definition = document.definitions.find(
      (item) => item.id === object.definition
    );
    if (
      !(definition && sameDefinition(definition, operation.expectedDefinition))
    ) {
      throw new Error(
        "The component properties changed. Reload before trying again."
      );
    }
  }
  if (operation.kind === "remove") {
    if (object.definition === SCENE_DEFINITION) {
      throw new Error(
        "A scene cannot be deleted: its place on the timeline lives in the code."
      );
    }
    if (isRemoved(document.objects, object.id)) {
      throw new Error(`${object.label} was already deleted.`);
    }
  } else if (object.removed !== true) {
    throw new Error(
      `${object.label} changed since it was deleted. Reload before trying again.`
    );
  }
  return {
    ...document,
    objects: document.objects.map((item) => {
      if (item.id !== object.id) {
        return item;
      }
      if (operation.kind === "remove") {
        return { ...item, removed: true as const };
      }
      const { removed: _removed, ...restored } = item;
      return restored;
    }),
    operations: [...document.operations, operation],
  };
}

function applyFieldOperation(
  document: StudioDocument,
  operation: StudioFieldOperation
): StudioDocument {
  const object = document.objects.find(
    (item) => item.id === operation.objectId
  );
  if (object === undefined) {
    throw new Error(
      "This object was removed. Reload the properties before editing."
    );
  }
  if (isRemoved(document.objects, object.id)) {
    throw new Error(
      `${object.label} was deleted. Undo the deletion before editing it.`
    );
  }
  const definition = document.definitions.find(
    (item) => item.id === object.definition
  );
  if (
    definition === undefined ||
    !sameDefinition(definition, operation.definition)
  ) {
    throw new Error(
      "The component properties changed. Reload them before saving this edit."
    );
  }
  const changes = studioOperationChanges(operation);
  if (new Set(changes.map((change) => change.field)).size !== changes.length) {
    throw new Error("An edit cannot change the same field twice.");
  }
  for (const change of changes) {
    const field = definition.fields.find((item) => item.id === change.field);
    if (field === undefined || !Object.hasOwn(object.values, field.id)) {
      throw new Error("This property no longer exists.");
    }
    if (!sameStudioValue(object.values[field.id], change.before)) {
      throw new Error(
        `${object.label}: ${field.label} changed elsewhere. Reload before trying again.`
      );
    }
    const problem = fieldProblem(field, change.after);
    if (problem !== null) {
      throw new Error(problem);
    }
  }
  const next = {
    ...document,
    objects: document.objects.map((item) =>
      item.id === object.id
        ? {
            ...item,
            values: {
              ...item.values,
              ...Object.fromEntries(
                changes.map((change) => [change.field, change.after])
              ),
            },
          }
        : item
    ),
    operations: [...document.operations, operation],
  };
  const problem = documentProblem(next);
  if (problem) {
    throw new Error(problem);
  }
  return next;
}

export function inverseStudioOperation(
  operation: StudioOperation,
  id: string
): StudioOperation {
  if (isCreationOperation(operation)) {
    return {
      expected: operation.object,
      expectedDefinition: operation.definition,
      id,
      kind: "remove",
      objectId: operation.objectId,
      undoOf: operation.id,
    };
  }
  if (isObjectOperation(operation)) {
    return {
      ...(operation.expected
        ? {
            expected:
              operation.kind === "remove"
                ? { ...operation.expected, removed: true as const }
                : restoredObject(operation.expected),
          }
        : {}),
      ...(operation.expectedDefinition
        ? { expectedDefinition: operation.expectedDefinition }
        : {}),
      id,
      kind: operation.kind === "remove" ? "restore" : "remove",
      objectId: operation.objectId,
      undoOf: operation.id,
    };
  }
  return {
    ...operation,
    after: operation.before,
    before: operation.after,
    ...(operation.changes === undefined
      ? {}
      : {
          changes: operation.changes.map((change) => ({
            ...change,
            after: change.before,
            before: change.after,
          })),
        }),
    id,
    undoOf: operation.id,
  };
}

export function studioOperationChanges(
  operation: Pick<
    StudioFieldOperation,
    "field" | "before" | "after" | "changes"
  >
): readonly StudioFieldChange[] {
  return [
    {
      after: operation.after,
      before: operation.before,
      field: operation.field,
    },
    ...(operation.changes ?? []),
  ];
}

function sameChanges(
  left: StudioFieldOperation,
  right: StudioFieldOperation
): boolean {
  const a = left.changes ?? [];
  const b = right.changes ?? [];
  return (
    a.length === b.length &&
    a.every((change, index) => {
      const other = b[index];
      return (
        change.field === other.field &&
        sameStudioValue(change.before, other.before) &&
        sameStudioValue(change.after, other.after)
      );
    })
  );
}

export function sameStudioValue(
  left: StudioValue,
  right: StudioValue
): boolean {
  return (
    left === right ||
    (Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

function numberProblem(field: StudioField, value: StudioValue): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${field.label} needs a finite number.`;
  }
  if (field.integer && !Number.isInteger(value)) {
    return `${field.label} needs a whole number.`;
  }
  if (field.min !== undefined && value < field.min) {
    return `${field.label} must be at least ${field.min}.`;
  }
  if (field.max !== undefined && value > field.max) {
    return `${field.label} must be at most ${field.max}.`;
  }
  return null;
}

export function fieldUnavailableReason(
  field: StudioField,
  values: Readonly<Record<string, StudioValue>>
): string | null {
  const condition = field.availableWhen;
  if (!condition) {
    return null;
  }
  const value = values[condition.field];
  let available: boolean;
  if (condition.operator === "equals") {
    available = value === condition.value;
  } else if (condition.operator === "greaterThan") {
    available =
      typeof value === "number" &&
      typeof condition.value === "number" &&
      value > condition.value;
  } else {
    available =
      Array.isArray(value) &&
      typeof condition.value === "number" &&
      value.length >= condition.value;
  }
  return available ? null : condition.reason;
}

export function sameStudioObject(
  left: StudioObject,
  right: StudioObject
): boolean {
  return (
    left.id === right.id &&
    left.definition === right.definition &&
    left.label === right.label &&
    left.parentId === right.parentId &&
    left.removed === right.removed &&
    left.shader?.slug === right.shader?.slug &&
    left.shader?.revision === right.shader?.revision &&
    left.shader?.slotId === right.shader?.slotId &&
    Object.keys(left.values).length === Object.keys(right.values).length &&
    Object.keys(left.values).every(
      (key) =>
        Object.hasOwn(right.values, key) &&
        sameStudioValue(left.values[key], right.values[key])
    )
  );
}

function sameOptionalObject(
  left: StudioObject | undefined,
  right: StudioObject | undefined
): boolean {
  return left === undefined
    ? right === undefined
    : right !== undefined && sameStudioObject(left, right);
}

function restoredObject(object: StudioObject): StudioObject {
  const { removed: _removed, ...rest } = object;
  return rest;
}

function applyCreation(
  document: StudioDocument,
  operation: StudioCreateOperation,
  target: ShaderTarget | undefined
): StudioDocument {
  if (
    !(target && sameShaderTarget(operation.target, target)) ||
    target.video !== document.video
  ) {
    throw new Error(
      "The shader target changed. Refresh the preview before adding it."
    );
  }
  if (
    operation.object.id !== operation.objectId ||
    operation.object.shader?.slotId !== target.slotId ||
    operation.object.parentId !== target.sceneId ||
    operation.object.removed ||
    operation.object.definition !== operation.definition.id
  ) {
    throw new Error(
      "The shader object does not match its target and definition."
    );
  }
  if (document.objects.some((item) => item.id === operation.objectId)) {
    throw new Error("This object ID is already reserved.");
  }
  if (
    target.sceneId !== null &&
    (!document.objects.some(
      (item) =>
        item.id === target.sceneId && item.definition === SCENE_DEFINITION
    ) ||
      isRemoved(document.objects, target.sceneId))
  ) {
    throw new Error("The target scene is no longer available.");
  }
  const existing = document.definitions.find(
    (item) => item.id === operation.definition.id
  );
  if (existing && !sameDefinition(existing, operation.definition)) {
    throw new Error(
      "The component properties changed. Reload before adding this shader."
    );
  }
  const next = {
    ...document,
    definitions: existing
      ? document.definitions
      : [...document.definitions, operation.definition],
    objects: [...document.objects, operation.object],
    operations: [...document.operations, operation],
  };
  const problem = documentProblem(next);
  if (problem) {
    throw new Error(problem);
  }
  return next;
}

function paletteProblem(field: StudioField, value: StudioValue): string | null {
  if (!isStudioPalette(value)) {
    return `${field.label} needs an ordered palette of hex colors.`;
  }
  if (
    value.length < (field.minItems ?? 1) ||
    value.length > (field.maxItems ?? 10)
  ) {
    return `${field.label} needs between ${field.minItems ?? 1} and ${field.maxItems ?? 10} colors.`;
  }
  return null;
}

function conditionProblem(
  field: StudioField,
  definition: StudioDefinition
): string | null {
  const condition = field.availableWhen;
  if (condition) {
    const dependency = definition.fields.find(
      (item) => item.id === condition.field
    );
    if (!dependency || dependency.id === field.id) {
      return `${field.label} has an invalid dependency.`;
    }
    if (
      (condition.operator === "greaterThan" &&
        (dependency.type !== "number" ||
          typeof condition.value !== "number")) ||
      (condition.operator === "lengthAtLeast" &&
        (dependency.type !== "palette" ||
          typeof condition.value !== "number" ||
          !Number.isInteger(condition.value) ||
          condition.value < 1)) ||
      (condition.operator === "equals" &&
        fieldProblem(dependency, condition.value) !== null)
    ) {
      return `${field.label} has an invalid dependency condition.`;
    }
  }

  return null;
}

function fieldMetadataProblem(field: StudioField): string | null {
  if (
    (field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max) ||
    (field.minItems ?? 1) > (field.maxItems ?? 10)
  ) {
    return `${field.label} has reversed bounds.`;
  }
  if (
    field.type !== "palette" &&
    (field.minItems !== undefined || field.maxItems !== undefined)
  ) {
    return `${field.label} is not a palette.`;
  }
  if (field.integer && field.type !== "number") {
    return `${field.label} is not a number.`;
  }
  if (field.step !== undefined && field.step <= 0) {
    return `${field.label} needs a positive step.`;
  }
  if (field.options && new Set(field.options).size !== field.options.length) {
    return `${field.label} has duplicate options.`;
  }

  return null;
}
