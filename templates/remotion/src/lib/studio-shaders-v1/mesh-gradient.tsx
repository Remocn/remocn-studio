import {
  getShaderColorFromString,
  meshGradientFragmentShader,
  ShaderFitOptions,
} from "@paper-design/shaders";
import { useMemo } from "react";
import { z } from "zod";
import type { ShaderAdapterProps } from "../studio-objects-v7/shaders";
import { PaperCanvas } from "./paper";

const Unit = z.number().finite().min(0).max(1);
const Parameters = z.object({
  colors: z
    .array(z.string().regex(/^#[\da-f]{6}([\da-f]{2})?$/i))
    .min(1)
    .max(10),
  distortion: Unit,
  fit: z.enum(["none", "contain", "cover"]),
  grainMixer: Unit,
  grainOverlay: Unit,
  offsetX: z.number().finite().min(-1).max(1),
  offsetY: z.number().finite().min(-1).max(1),
  originX: Unit,
  originY: Unit,
  rotation: z.number().finite().min(0).max(360),
  scale: z.number().finite().min(0.01).max(4),
  speed: z.number().finite().min(-5).max(5),
  swirl: Unit,
});

export function MeshGradientAdapter({
  values,
  frame,
  fps,
  onReady,
  onError,
}: ShaderAdapterProps) {
  const encoded = JSON.stringify(values);
  const { uniforms, speed } = useMemo(() => {
    const params = Parameters.parse(JSON.parse(encoded));
    return {
      speed: params.speed,
      uniforms: {
        u_colors: params.colors.map(getShaderColorFromString),
        u_colorsCount: params.colors.length,
        u_distortion: params.distortion,
        u_fit: ShaderFitOptions[params.fit],
        u_grainMixer: params.grainMixer,
        u_grainOverlay: params.grainOverlay,
        u_offsetX: params.offsetX,
        u_offsetY: params.offsetY,
        u_originX: params.originX,
        u_originY: params.originY,
        u_rotation: params.rotation,
        u_scale: params.scale,
        u_swirl: params.swirl,
        u_worldHeight: 0,
        u_worldWidth: 0,
      },
    };
  }, [encoded]);
  return (
    <PaperCanvas
      fragment={meshGradientFragmentShader}
      onError={onError}
      onReady={onReady}
      time={(frame / fps) * speed * 1000}
      uniforms={uniforms}
    />
  );
}
