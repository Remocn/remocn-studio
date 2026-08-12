"use client";

import type React from "react";
import { AbsoluteFill } from "remotion";
import {
  type CanvasFilterProps,
  makeCanvasFilter,
  makeFilterShader,
} from "../../lib/remocn/canvas-presentation";

export type CrtScreenProps = {
  curvature?: number;
  scanlines?: number;
  maskScale?: number;
  vignette?: number;
};

const DEFAULTS = {
  curvature: 1,
  scanlines: 1,
  maskScale: 2,
  vignette: 1,
};

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_scene;
uniform float u_frame;
uniform float u_curvature;
uniform float u_scanlines;
uniform float u_mask_scale;
uniform float u_vignette;

in vec2 v_uv;
out vec4 outColor;

const float PI = 3.141592653589793;
const float SCAN_LINES = 240.0;

vec2 warpTube(vec2 uv, float k) {
  vec2 p = uv * 2.0 - 1.0;
  float x2 = p.x * p.x;
  float y2 = p.y * p.y;
  p.x *= 1.0 + k * 0.11 * y2;
  p.y *= 1.0 + k * 0.17 * x2;
  p /= 1.0 + k * 0.045;
  return p * 0.5 + 0.5;
}

vec3 phosphorMask(float x, float scale) {
  float sub = mod(floor(x / max(scale, 1.0)), 3.0);
  vec3 lit = vec3(
    step(sub, 0.5),
    step(0.5, sub) * step(sub, 1.5),
    step(1.5, sub)
  );
  return mix(vec3(0.34), vec3(1.0), lit);
}

void main() {
  vec2 uv = warpTube(v_uv, u_curvature);

  vec2 edge =
    smoothstep(vec2(0.0), vec2(0.005), uv) *
    smoothstep(vec2(0.0), vec2(0.005), 1.0 - uv);
  float inside = edge.x * edge.y;

  vec4 base = texture(u_scene, uv);

  vec3 spread = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    spread += texture(u_scene, uv + vec2(float(i) * 0.0018, 0.0)).rgb;
  }
  spread /= 5.0;
  vec3 bloom = max(spread - 0.5, vec3(0.0));

  vec3 color = base.rgb;
  color *= phosphorMask(gl_FragCoord.x, u_mask_scale);
  color += bloom * 0.75;

  float scan = mix(1.0, 0.5 + 0.5 * cos(uv.y * SCAN_LINES * PI * 2.0), 0.55);
  color *= mix(1.0, scan, clamp(u_scanlines, 0.0, 1.5));

  vec2 vc = uv * 2.0 - 1.0;
  float radius = length(vc * vec2(0.86, 1.0));
  color *= mix(1.0, smoothstep(1.6, 0.35, radius), clamp(u_vignette, 0.0, 1.5));

  color *= 1.0 + 0.012 * sin(u_frame * PI / 30.0);
  color *= inside;

  outColor = vec4(clamp(color, 0.0, 1.0), max(base.a, 1.0 - inside));
}`;

const shader = makeFilterShader<CrtScreenProps>(
  FRAGMENT_SHADER,
  ({ gl, uniform, passedProps }) => {
    const {
      curvature = DEFAULTS.curvature,
      scanlines = DEFAULTS.scanlines,
      maskScale = DEFAULTS.maskScale,
      vignette = DEFAULTS.vignette,
    } = passedProps;
    gl.uniform1f(uniform("u_curvature"), curvature);
    gl.uniform1f(uniform("u_scanlines"), scanlines);
    gl.uniform1f(uniform("u_mask_scale"), maskScale);
    gl.uniform1f(uniform("u_vignette"), vignette);
  },
);

const CrtScreenFallback: React.FC<CrtScreenProps & CanvasFilterProps> = ({
  children,
  scanlines = DEFAULTS.scanlines,
  vignette = DEFAULTS.vignette,
}) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ filter: "saturate(1.1) contrast(1.06)" }}>
      {children}
    </AbsoluteFill>
    <AbsoluteFill
      style={{
        background:
          "repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.34) 0px, rgba(0, 0, 0, 0.34) 1.5px, transparent 1.5px, transparent 3px)",
        opacity: Math.min(scanlines, 1),
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 82% 78% at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.72) 100%)",
        opacity: Math.min(vignette, 1),
      }}
    />
  </AbsoluteFill>
);

export const CrtScreen = makeCanvasFilter<CrtScreenProps>({
  shader,
  fallback: CrtScreenFallback,
});
