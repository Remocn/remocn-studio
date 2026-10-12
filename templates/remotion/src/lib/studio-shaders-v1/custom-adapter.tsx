import {
  getShaderColorFromString,
  type ShaderMountUniforms,
} from "@paper-design/shaders";
import { useMemo } from "react";
import type { ShaderAdapterProps } from "../studio-objects-v7/shaders";
import { PaperCanvas } from "./paper";
import { type ParameterField, parameters } from "./parameters";

export function customUniforms(
  fields: readonly ParameterField[],
  values: ShaderAdapterProps["values"],
  bindings: Readonly<Record<string, string>>,
  colors: readonly string[]
) {
  const p = parameters(fields, values);
  const uniforms: ShaderMountUniforms = {
    u_offset: [p.offsetX as number, p.offsetY as number],
    u_patternScale: p.patternScale as number,
    u_rotation: p.rotation as number,
  };
  for (const [key, uniform] of Object.entries(bindings)) {
    const v = p[key];
    uniforms[uniform] =
      typeof v === "string"
        ? getShaderColorFromString(v).slice(0, 3)
        : (v as number);
  }
  colors.forEach((uniform, i) => {
    uniforms[uniform] = getShaderColorFromString(
      (p.colors as readonly string[])[i]
    ).slice(0, 3);
  });
  return { speed: p.speed as number, uniforms };
}
export function createCustomAdapter(
  fragment: string,
  fields: readonly ParameterField[],
  bindings: Readonly<Record<string, string>>,
  colors: readonly string[]
) {
  return function CustomShaderAdapter({
    values,
    frame,
    fps,
    onReady,
    onError,
  }: ShaderAdapterProps) {
    const encoded = JSON.stringify(values);
    const data = useMemo(
      () => customUniforms(fields, JSON.parse(encoded), bindings, colors),
      [encoded]
    );
    return (
      <PaperCanvas
        fragment={fragment}
        onError={onError}
        onReady={onReady}
        time={(frame / fps) * data.speed * 1000}
        uniforms={data.uniforms}
      />
    );
  };
}
