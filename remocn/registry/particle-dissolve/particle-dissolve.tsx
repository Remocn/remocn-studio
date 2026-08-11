"use client";

import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import type React from "react";
import { AbsoluteFill } from "remotion";
import {
  makeCanvasPresentation,
  makeSceneShader,
} from "../../lib/remocn/canvas-presentation";

export type ParticleDissolveDirection =
  | "reveal"
  | "up"
  | "down"
  | "left"
  | "right";

export type ParticleDissolveProps = {
  particleSize?: number;
  scatter?: number;
  shimmer?: number;
  aberration?: number;
  direction?: ParticleDissolveDirection;
  stagger?: number;
};

const DEFAULTS = {
  particleSize: 4,
  scatter: 0.08,
  shimmer: 0.6,
  aberration: 0.5,
  direction: "reveal" as ParticleDissolveDirection,
  stagger: 0.55,
};

const AXES: Record<ParticleDissolveDirection, [number, number]> = {
  reveal: [0, 0],
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform float u_aspect;
uniform float u_cells;
uniform float u_scatter;
uniform float u_shimmer;
uniform float u_aberration;
uniform float u_stagger;
uniform vec2 u_dir;
uniform float u_radial;

in vec2 v_uv;
out vec4 outColor;

const float PI = 3.141592653589793;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += noise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return sum * 1.0667;
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec4 grab(sampler2D tex, vec2 uv, vec2 dir, float amount) {
  vec4 centre = texture(tex, uv);
  float r = texture(tex, uv + dir * amount).r;
  float b = texture(tex, uv - dir * amount).b;
  return vec4(r, centre.g, b, centre.a);
}

void main() {
  vec2 grid = vec2(u_cells * u_aspect, u_cells);
  vec2 skewed = vec2(v_uv.x * u_aspect, v_uv.y);
  vec2 centred = skewed - vec2(0.5 * u_aspect, 0.5);

  float spatial = u_radial > 0.5
    ? clamp(length(centred) / 0.62, 0.0, 1.0)
    : clamp(dot(v_uv - 0.5, u_dir) + 0.5, 0.0, 1.0);
  float blob = fbm(skewed * 2.2);
  float order = mix(blob, spatial, 0.55) * u_stagger;
  float span = max(1.0 - u_stagger, 0.08);
  float phase = clamp((u_progress - order) / span, 0.0, 1.0);
  float dust = sin(phase * PI);

  vec2 flow = vec2(
    fbm(skewed * 3.0 + vec2(0.0, u_progress * 0.8)),
    fbm(skewed * 3.0 + vec2(5.3, 2.7 - u_progress * 0.7))
  ) - 0.5;
  vec2 aim =
    flow * 2.0 + normalize(centred + 0.0001) * 0.7 * u_radial + u_dir;
  vec2 heading = aim / max(length(aim), 0.0001);

  float bright = luma(texture(u_from, v_uv).rgb);
  float travel = u_scatter * dust * (0.18 + bright * 1.25);
  vec2 drift = vec2(heading.x / u_aspect, heading.y) * travel;

  float split = u_aberration * dust * 0.35;
  vec4 leaving = grab(u_from, v_uv - drift, drift, split);
  vec4 arriving = grab(u_to, v_uv + drift, -drift, split);

  vec4 base = mix(leaving, arriving, smoothstep(0.25, 0.75, phase));
  base.rgb = mix(base.rgb, vec3(luma(base.rgb)), dust);
  base.rgb *= 1.0 - dust * 0.25;

  vec2 g = (v_uv - drift) * grid;
  vec2 origin = floor(g);
  float cover = 0.0;
  float light = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 cell = origin + vec2(float(ox), float(oy));
      vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 8.7));
      float mote = hash(cell + 13.7);
      float twinkle =
        0.5 + 0.5 * sin(u_progress * (12.0 + mote * 30.0) + mote * 6.2831);
      float radius =
        (0.36 + 0.46 * hash(cell + 21.3)) * (0.65 + 0.6 * twinkle);
      float reach = length(g - (cell + jitter));
      float hit = 1.0 - smoothstep(radius * 0.45, radius, reach);
      cover = max(cover, hit);
      light = max(light, hit * mote * twinkle);
    }
  }
  cover = mix(1.0, cover, dust);
  light *= dust;

  vec4 speck = vec4(
    base.rgb + vec3(0.36 * light * u_shimmer) * base.a,
    base.a
  );
  vec4 gap = vec4(base.rgb * (1.0 - dust * 0.6), base.a);
  outColor = mix(gap, speck, cover);
}`;

const shader = makeSceneShader<ParticleDissolveProps>(
  FRAGMENT_SHADER,
  ({ gl, uniform, height, passedProps }) => {
    const {
      particleSize = DEFAULTS.particleSize,
      scatter = DEFAULTS.scatter,
      shimmer = DEFAULTS.shimmer,
      aberration = DEFAULTS.aberration,
      direction = DEFAULTS.direction,
      stagger = DEFAULTS.stagger,
    } = passedProps;
    const axis = AXES[direction] ?? AXES[DEFAULTS.direction];
    gl.uniform1f(uniform("u_cells"), height / Math.max(particleSize, 1));
    gl.uniform1f(uniform("u_scatter"), scatter);
    gl.uniform1f(uniform("u_shimmer"), shimmer);
    gl.uniform1f(uniform("u_aberration"), aberration);
    gl.uniform1f(uniform("u_stagger"), Math.min(Math.max(stagger, 0), 0.92));
    gl.uniform2f(uniform("u_dir"), axis[0], axis[1]);
    gl.uniform1f(uniform("u_radial"), direction === "reveal" ? 1 : 0);
  },
);

const ParticleDissolveFallback: React.FC<
  TransitionPresentationComponentProps<ParticleDissolveProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  const entering = presentationDirection === "entering";
  const t = entering ? p : 1 - p;
  const settle = Math.min(1, Math.max(0, (t - 0.2) / 0.6));
  const grain = 1 - settle;

  return (
    <AbsoluteFill
      style={{
        opacity: settle,
        filter:
          grain > 0.02
            ? `blur(${grain * 10}px) saturate(${1 - grain * 0.9}) contrast(${1 + grain * 0.5})`
            : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const presentation = makeCanvasPresentation<ParticleDissolveProps>({
  shader,
  fallback: ParticleDissolveFallback,
});

export function particleDissolve(
  props: ParticleDissolveProps = {},
): TransitionPresentation<ParticleDissolveProps> {
  return presentation(props);
}
