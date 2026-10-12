import { Schema } from "effect";
import catalogue from "./shader-presets.json";
import { ShaderIdentifier } from "./shader-target";
import {
  SHADER_DESCRIPTORS,
  type ShaderDescriptor,
  ShaderPreset,
  type ShaderStart,
} from "./shaders";

export const ShaderPresetCatalogue = Schema.Struct({
  excluded: Schema.Array(
    Schema.Struct({
      reason: Schema.NonEmptyString,
      slug: ShaderIdentifier,
    })
  ),
  presets: Schema.Array(ShaderPreset),
});
export type ShaderPresetCatalogue = typeof ShaderPresetCatalogue.Type;

const decoded = Schema.decodeUnknownSync(ShaderPresetCatalogue)(catalogue);
export const SHADER_PRESETS: readonly ShaderPreset[] = decoded.presets;
export const EXCLUDED_SHADER_PRESETS = decoded.excluded;

export interface ShaderCatalogueEntry extends ShaderStart {
  readonly descriptor: ShaderDescriptor;
}

export function shaderCatalogueEntry(
  slug: string
): ShaderCatalogueEntry | null {
  const descriptor = SHADER_DESCRIPTORS.find((item) => item.slug === slug);
  if (descriptor) {
    return { descriptor, title: descriptor.title, values: {} };
  }
  const preset = SHADER_PRESETS.find((item) => item.slug === slug);
  const base =
    preset && SHADER_DESCRIPTORS.find((item) => item.slug === preset.base);
  return preset && base
    ? { descriptor: base, title: preset.title, values: preset.values }
    : null;
}
