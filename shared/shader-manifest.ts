import { Schema } from "effect";
import { ShaderIdentifier } from "./shader-target";

export const ShaderSourcePath = Schema.NonEmptyString.check(
  Schema.isPattern(/^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/)
);
const Hash = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));

export const ShaderManifest = Schema.Struct({
  implementations: Schema.Array(
    Schema.Struct({ revision: ShaderIdentifier, slug: ShaderIdentifier })
  ),
  slots: Schema.Array(
    Schema.Struct({
      id: ShaderIdentifier,
      label: Schema.NonEmptyString,
      sceneId: Schema.NullOr(ShaderIdentifier),
      source: ShaderSourcePath,
    })
  ),
  sourceRevision: Hash,
  sources: Schema.Record(ShaderSourcePath, Hash),
  version: Schema.Literal(1),
  video: ShaderIdentifier,
}).check(
  Schema.makeFilter((manifest) => {
    if (
      new Set(manifest.slots.map((slot) => slot.id)).size !==
      manifest.slots.length
    ) {
      return "Shader slot IDs must be unique.";
    }
    if (
      manifest.slots.some(
        (slot) => !Object.hasOwn(manifest.sources, slot.source)
      )
    ) {
      return "Each slot needs a checked source binding.";
    }
    if (
      new Set(manifest.implementations.map((entry) => entry.slug)).size !==
      manifest.implementations.length
    ) {
      return "Shader implementations must be unique.";
    }
    return true;
  })
);
export type ShaderManifest = typeof ShaderManifest.Type;
