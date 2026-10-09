// GLSL adapted from the bundled remocn source; see catalog-v1.md.
export const fragment = `#version 300 es

precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform float u_intensity;
uniform vec3 u_floor;
uniform vec3 u_light;
uniform vec3 u_accent;
uniform float u_accentAmt;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

uniform float u_patternScale;
uniform float u_rotation;
uniform vec2 u_offset;
vec2 studioPosition(vec2 pixel) {
  vec2 p = (pixel / u_resolution - 0.5 - u_offset) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float angle = radians(u_rotation);
  p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p / u_patternScale;
  return p / vec2(u_resolution.x / u_resolution.y, 1.0) + 0.5;
}

void main() {
  vec2 uv = studioPosition(gl_FragCoord.xy);
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * u_scale;

  // Iterative trigonometric warp: each pass bends the sample point by the
  // previous pass, and the reciprocal distance to the warped axes
  // accumulates into the caustic web.
  float t = u_time * 0.35;
  vec2 i = p;
  float c = 0.0;
  for (int n = 0; n < 4; n++) {
    float phase = t * (1.0 - 3.2 / float(n + 2));
    i = p + vec2(
      cos(phase - i.x) + sin(phase + i.y),
      sin(phase - i.y) + cos(phase + i.x)
    );
    c += 1.0 / length(vec2(
      p.x / (sin(i.x + phase) * 90.0),
      p.y / (cos(i.y + phase) * 90.0)
    ));
  }
  c /= 4.0;
  c = 1.24 - pow(abs(c), 1.35);
  // |c| collapses to zero along thin branching veins — that zero-crossing
  // set IS the caustic web. Light the veins with an exponential falloff
  // (sharp core + a soft halo) and leave everything else near-black.
  float web = exp(-abs(c) * 0.5) + 0.22 * exp(-abs(c) * 0.12);
  web = web / (1.0 + 0.6 * web);

  // The light lands on the base: filaments read stronger low in the frame.
  float ground = mix(1.25, 0.55, uv.y);
  web *= ground * u_intensity;

  // Vignette keeps the corners quiet so type always wins.
  vec2 v = uv - 0.5;
  float vig = 1.0 - dot(v, v) * 1.1;
  web *= clamp(vig, 0.0, 1.0);

  vec3 filament = mix(u_light, u_accent, clamp(u_accentAmt, 0.0, 1.0));
  vec3 col = u_floor + filament * web;

  // A whisper of living grain, time-derived so it stays deterministic.
  col += (hash(gl_FragCoord.xy + floor(u_time * 9.0)) - 0.5) * 0.012;

  fragColor = vec4(col, 1.0);
}
`;
