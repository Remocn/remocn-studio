import { Schema } from "effect";
import catalog from "./shader-catalog.json";
import {
  ShaderIdentifier,
  ShaderSlotReport,
  ShaderTarget,
} from "./shader-target";
import {
  definitionProblem,
  type StudioCreateOperation,
  StudioDefinition,
  type StudioField,
  StudioSnapshot,
} from "./studio-document";

export const PAPER_SHADER_VERSION = "0.0.78";
export const SHADER_REVISION = "paper-0-0-78-v1";

export const ShaderDescriptor = Schema.Struct({
  adapter: Schema.Literals(["paper", "custom"]),
  definition: StudioDefinition,
  exportName: Schema.NonEmptyString.check(
    Schema.isPattern(/^[A-Z][A-Za-z0-9]*$/)
  ),
  packageVersion: Schema.optionalKey(Schema.NonEmptyString),
  revision: ShaderIdentifier,
  slug: ShaderIdentifier,
  title: Schema.NonEmptyString,
  version: Schema.Literal(1),
}).check(
  Schema.makeFilter((descriptor) => {
    const problem = definitionProblem(descriptor.definition);
    if (problem) {
      return problem;
    }
    if (
      descriptor.adapter === "paper" &&
      descriptor.packageVersion !== PAPER_SHADER_VERSION
    ) {
      return "This Paper shader version is not supported.";
    }
    if (
      descriptor.definition.id !== `${descriptor.slug}-${descriptor.revision}`
    ) {
      return "The shader definition must identify its implementation revision.";
    }
    return true;
  })
);
export type ShaderDescriptor = typeof ShaderDescriptor.Type;

export const ShaderProgress = Schema.Struct({
  message: Schema.NonEmptyString,
  operationId: Schema.NonEmptyString,
  phase: Schema.Literals([
    "validate",
    "dependencies",
    "resources",
    "connect",
    "capability",
    "commit",
    "preview",
    "complete",
  ]),
  projectId: Schema.NonEmptyString,
  video: ShaderIdentifier,
});
export type ShaderProgress = typeof ShaderProgress.Type;

export const ShaderReceipt = Schema.Struct({
  objectId: ShaderIdentifier,
  operationId: Schema.NonEmptyString,
  target: ShaderTarget,
});
export type ShaderReceipt = typeof ShaderReceipt.Type;
export const ShaderInserted = Schema.Struct({
  receipt: ShaderReceipt,
  snapshot: StudioSnapshot,
});
export type ShaderInserted = typeof ShaderInserted.Type;

export const ShaderInsertRequest = Schema.Struct({
  objectId: ShaderIdentifier,
  operationId: Schema.NonEmptyString,
  slug: ShaderIdentifier,
  target: ShaderTarget,
});
export type ShaderInsertRequest = typeof ShaderInsertRequest.Type;

export const ShaderTargetReport = Schema.Struct({
  generation: Schema.NullOr(Schema.NonEmptyString),
  projectId: Schema.NonEmptyString,
  report: Schema.optionalKey(Schema.Array(ShaderSlotReport)),
  video: ShaderIdentifier,
});
export type ShaderTargetReport = typeof ShaderTargetReport.Type;
export const ShaderPreparation = Schema.Struct({
  historyId: Schema.NonEmptyString,
  message: Schema.String,
  phase: Schema.Literals([
    "preparing",
    "validating",
    "activating",
    "ready",
    "failed",
  ]),
});
export type ShaderPreparation = typeof ShaderPreparation.Type;
export const ShaderTargets = Schema.Struct({
  adaptation: Schema.Boolean,
  preparation: Schema.optionalKey(ShaderPreparation),
  preparationRevision: Schema.optionalKey(Schema.NonEmptyString),
  reason: Schema.NullOr(Schema.NonEmptyString),
  targets: Schema.Array(ShaderTarget),
});
export type ShaderTargets = typeof ShaderTargets.Type;
export const ShaderInsertionStatus = Schema.Union([
  Schema.Struct({ state: Schema.Literal("unknown") }),
  Schema.Struct({
    request: ShaderInsertRequest,
    state: Schema.Literal("preparing"),
  }),
  Schema.Struct({ result: ShaderInserted, state: Schema.Literal("saved") }),
  Schema.Struct({
    message: Schema.NonEmptyString,
    request: ShaderInsertRequest,
    state: Schema.Literal("failed"),
  }),
]);
export type ShaderInsertionStatus = typeof ShaderInsertionStatus.Type;

function number(
  id: string,
  label: string,
  value: number,
  min: number,
  max: number,
  group: string,
  step = 0.01
): StudioField {
  return { default: value, group, id, label, max, min, step, type: "number" };
}

export const SHADER_INSTANCE_FIELDS: readonly StudioField[] = [
  number("opacity", "Opacity", 1, 0, 1, "Layer"),
  {
    default: 0,
    group: "Layer",
    id: "order",
    integer: true,
    label: "Layer order",
    min: 0,
    step: 1,
    type: "number",
  },
  {
    default: 0,
    group: "Timing",
    id: "startFrame",
    integer: true,
    label: "Start",
    min: 0,
    step: 1,
    type: "number",
    unit: "frames",
  },
  {
    default: true,
    group: "Timing",
    id: "followSceneEnd",
    label: "Follow scene end",
    type: "boolean",
  },
  {
    availableWhen: {
      field: "followSceneEnd",
      operator: "equals",
      reason: "Turn off Follow scene end to trim the end.",
      value: false,
    },
    default: 1,
    group: "Timing",
    id: "endFrame",
    integer: true,
    label: "End",
    min: 1,
    step: 1,
    type: "number",
    unit: "frames",
  },
];

export const PAPER_PATTERN_FIELDS: readonly StudioField[] = [
  number("speed", "Speed", 1, -5, 5, "Animation"),
  number("scale", "Scale", 1, 0.01, 4, "Pattern"),
  number("rotation", "Rotation", 0, 0, 360, "Pattern", 1),
  number("offsetX", "Horizontal offset", 0, -1, 1, "Pattern"),
  number("offsetY", "Vertical offset", 0, -1, 1, "Pattern"),
  number("originX", "Horizontal origin", 0.5, 0, 1, "Pattern"),
  number("originY", "Vertical origin", 0.5, 0, 1, "Pattern"),
  {
    default: "cover",
    group: "Pattern",
    id: "fit",
    label: "Fit",
    options: ["none", "contain", "cover"],
    type: "enum",
  },
];

export const MESH_GRADIENT: ShaderDescriptor = ShaderDescriptor.make({
  adapter: "paper",
  definition: {
    fields: [
      {
        default: ["#12121a", "#232338", "#3a3a5c", "#52527a"],
        group: "Colors",
        id: "colors",
        label: "Colors",
        maxItems: 10,
        minItems: 1,
        type: "palette",
      },
      number("distortion", "Distortion", 0.6, 0, 1, "Appearance"),
      number("swirl", "Swirl", 0.1, 0, 1, "Appearance"),
      number("grainMixer", "Grain mixer", 0, 0, 1, "Appearance"),
      number("grainOverlay", "Grain overlay", 0, 0, 1, "Appearance"),
      ...PAPER_PATTERN_FIELDS,
      ...SHADER_INSTANCE_FIELDS,
    ],
    id: `shader-mesh-gradient-${SHADER_REVISION}`,
    version: 1,
  },
  exportName: "MeshGradient",
  packageVersion: PAPER_SHADER_VERSION,
  revision: SHADER_REVISION,
  slug: "shader-mesh-gradient",
  title: "Mesh Gradient",
  version: 1,
});

export const SHADER_DESCRIPTORS: readonly ShaderDescriptor[] = [
  MESH_GRADIENT,
  ...catalog.map((entry) => Schema.decodeUnknownSync(ShaderDescriptor)(entry)),
];

export function shaderCreation(
  descriptor: ShaderDescriptor,
  target: ShaderTarget,
  operationId: string,
  objectId: string,
  order: number
): StudioCreateOperation {
  return {
    definition: descriptor.definition,
    id: operationId,
    kind: "create",
    object: {
      definition: descriptor.definition.id,
      id: objectId,
      label: descriptor.title,
      parentId: target.sceneId,
      shader: {
        revision: descriptor.revision,
        slotId: target.slotId,
        slug: descriptor.slug,
      },
      values: {
        ...Object.fromEntries(
          descriptor.definition.fields.map((field) => [field.id, field.default])
        ),
        endFrame: target.durationInFrames,
        order,
      },
    },
    objectId,
    target,
  };
}
