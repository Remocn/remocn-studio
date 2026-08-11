"use client";

import type React from "react";
import { AbsoluteFill } from "remotion";
import {
  type CanvasFilterProps,
  makeCanvasFilter,
  makeFilterShader,
} from "../../lib/remocn/canvas-presentation";

export type CameraLensProps = {
  softness?: number;
  bloom?: number;
  aberration?: number;
  vignette?: number;
  distortion?: number;
};

const DEFAULTS = {
  softness: 0.5,
  bloom: 0.5,
  aberration: 0.5,
  vignette: 0.5,
  distortion: 0.05,
};

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_scene;
uniform float u_aspect;
uniform float u_softness;
uniform float u_bloom;
uniform float u_aberration;
uniform float u_vignette;
uniform float u_distortion;

in vec2 v_uv;
out vec4 outColor;

const int SOFT_TAPS = 6;
const int GLARE_TAPS = 8;
const float GOLDEN = 2.39996323;

vec2 lensUv(vec2 direction, float distance) {
  vec2 q = direction * distance;
  q.x /= u_aspect;
  return q * 0.5 + 0.5;
}

vec2 spiral(int index, int count, float radius, float turn) {
  float angle = float(index) * GOLDEN + turn;
  float step = sqrt((float(index) + 0.5) / float(count)) * radius;
  return vec2(cos(angle) * step / u_aspect, sin(angle) * step);
}

vec4 softSample(vec2 uv, float radius) {
  vec4 sum = texture(u_scene, uv);
  if (radius <= 0.00002) {
    return sum;
  }
  for (int i = 0; i < SOFT_TAPS; i++) {
    sum += texture(u_scene, uv + spiral(i, SOFT_TAPS, radius, 0.0));
  }
  return sum / float(SOFT_TAPS + 1);
}

void main() {
  vec2 p = (v_uv - 0.5) * 2.0;
  p.x *= u_aspect;

  float span = sqrt(u_aspect * u_aspect + 1.0);
  float reach = length(p);
  float radius = reach / span;
  vec2 direction = reach > 0.0001 ? p / reach : vec2(0.0);

  float bend = 1.0 / (1.0 + clamp(u_distortion, 0.0, 1.0) * radius * radius);
  float focused = reach * bend;
  vec2 base = lensUv(direction, focused);

  float soft = u_softness * 0.011 * smoothstep(0.22, 1.0, radius);
  float split = u_aberration * 0.0035 * radius;

  vec4 mid = softSample(base, soft);
  float red = softSample(lensUv(direction, focused * (1.0 + split)), soft).r;
  float blue = softSample(lensUv(direction, focused * (1.0 - split)), soft).b;
  vec3 color = vec3(red, mid.g, blue);

  vec3 glare = vec3(0.0);
  for (int i = 0; i < GLARE_TAPS; i++) {
    vec3 tap =
      texture(u_scene, base + spiral(i, GLARE_TAPS, u_bloom * 0.026, 0.7)).rgb;
    glare += max(tap - 0.62, vec3(0.0));
  }
  color += (glare / float(GLARE_TAPS)) * u_bloom * 1.4;

  float falloff = pow(cos(min(radius, 1.0) * 0.55), 4.0);
  color *= mix(1.0, falloff, clamp(u_vignette, 0.0, 1.5));

  outColor = vec4(clamp(color, 0.0, 1.0), mid.a);
}`;

const shader = makeFilterShader<CameraLensProps>(
  FRAGMENT_SHADER,
  ({ gl, uniform, passedProps }) => {
    const {
      softness = DEFAULTS.softness,
      bloom = DEFAULTS.bloom,
      aberration = DEFAULTS.aberration,
      vignette = DEFAULTS.vignette,
      distortion = DEFAULTS.distortion,
    } = passedProps;
    gl.uniform1f(uniform("u_softness"), softness);
    gl.uniform1f(uniform("u_bloom"), bloom);
    gl.uniform1f(uniform("u_aberration"), aberration);
    gl.uniform1f(uniform("u_vignette"), vignette);
    gl.uniform1f(uniform("u_distortion"), distortion);
  },
);

const CameraLensFallback: React.FC<CameraLensProps & CanvasFilterProps> = ({
  children,
  bloom = DEFAULTS.bloom,
  vignette = DEFAULTS.vignette,
}) => (
  <AbsoluteFill>
    <AbsoluteFill>{children}</AbsoluteFill>
    <AbsoluteFill
      style={{
        filter: `blur(${6 * bloom}px) brightness(1.5) contrast(1.3)`,
        mixBlendMode: "screen",
        opacity: 0.3 * bloom,
      }}
    >
      {children}
    </AbsoluteFill>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 78% 76% at 50% 50%, transparent 52%, rgba(0, 0, 0, 0.5) 100%)",
        opacity: Math.min(vignette, 1),
      }}
    />
  </AbsoluteFill>
);

export const CameraLens = makeCanvasFilter<CameraLensProps>({
  shader,
  fallback: CameraLensFallback,
});
