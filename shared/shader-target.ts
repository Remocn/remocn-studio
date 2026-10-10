import { Schema } from "effect";

export const ShaderIdentifier = Schema.NonEmptyString.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
);

const Frame = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const ShaderIdentity = Schema.Struct({
  revision: ShaderIdentifier,
  slotId: ShaderIdentifier,
  slug: ShaderIdentifier,
});
export type ShaderIdentity = typeof ShaderIdentity.Type;

export const ShaderTarget = Schema.Struct({
  contract: Schema.Literal(1),
  durationInFrames: Schema.Int.check(Schema.isGreaterThan(0)),
  fps: Schema.Finite.check(Schema.isGreaterThan(0)),
  from: Frame,
  generation: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  sceneId: Schema.NullOr(ShaderIdentifier),
  slotId: ShaderIdentifier,
  sourceRevision: Schema.NonEmptyString,
  video: ShaderIdentifier,
});
export type ShaderTarget = typeof ShaderTarget.Type;

export const ShaderSlotReport = Schema.Struct({
  contract: Schema.Literal(1),
  durationInFrames: Schema.Int.check(Schema.isGreaterThan(0)),
  fps: Schema.Finite.check(Schema.isGreaterThan(0)),
  from: Frame,
  label: Schema.NonEmptyString,
  occurrences: Schema.Int.check(Schema.isGreaterThan(0)),
  sceneId: Schema.NullOr(ShaderIdentifier),
  slotId: ShaderIdentifier,
  sourceRevision: Schema.NonEmptyString,
});
export type ShaderSlotReport = typeof ShaderSlotReport.Type;

export function sameShaderTarget(
  left: ShaderTarget,
  right: ShaderTarget
): boolean {
  return Object.keys(ShaderTarget.fields).every(
    (key) =>
      left[key as keyof ShaderTarget] === right[key as keyof ShaderTarget]
  );
}

export function shaderTargetsAtFrame(
  targets: readonly ShaderTarget[],
  frame: number
) {
  return targets.filter(
    (target) =>
      frame >= target.from && frame < target.from + target.durationInFrames
  );
}
