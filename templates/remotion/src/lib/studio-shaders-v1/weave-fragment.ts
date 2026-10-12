// GLSL adapted from the bundled remocn source; see catalog-v1.md.
export const fragment = `#version 300 es

precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform float u_warp;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_accent;
uniform float u_accentAmt;

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
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// A thin ridge line at every integer of x — the profile of one thread.
float thread(float x, float sharp) {
  float f = fract(x);
  float d = min(f, 1.0 - f);
  return smoothstep(sharp, 0.0, d);
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

  // Domain warp — bend the weave so it reads hand-made, not a CSS grid. The
  // warp field drifts very slowly; the grid lattice itself stays put.
  vec2 q = uv + u_warp * vec2(
    fbm(uv * 3.0 + vec2(u_time * 0.03, 0.0)) - 0.5,
    fbm(uv * 3.0 + vec2(7.3, -u_time * 0.02)) - 0.5
  );

  float qx = q.x * u_scale * aspect;
  float qy = q.y * u_scale;

  float tw = thread(qx, 0.09); // warp (vertical threads)
  float tf = thread(qy, 0.09); // weft (horizontal threads)

  // Interlace: per cell, one direction sits over the other.
  float over = mod(floor(qx) + floor(qy), 2.0);
  float warpB = tw * (over < 0.5 ? 1.0 : 0.5);
  float weftB = tf * (over < 0.5 ? 0.5 : 1.0);
  float weave = max(warpB, weftB);

  // Sheen — light travelling across a still cloth (this is the only motion).
  float sheen = fbm(q * 1.7 + vec2(u_time * 0.05, u_time * 0.028));
  weave *= 0.3 + 0.95 * sheen;

  // Fabric ground: near-black, faintly breathing between the shadow stops.
  vec3 base = mix(u_c0, u_c1, smoothstep(0.15, 0.8, sheen));
  base = mix(base, u_c2, smoothstep(0.62, 1.0, sheen) * 0.5);

  // Threads sit a touch above the ground.
  vec3 col = mix(base, u_c3, clamp(weave, 0.0, 1.0) * 0.55);

  // The accent runs through the threads — a violet thread across the cloth.
  float amt = clamp(u_accentAmt, 0.0, 1.0);
  col = mix(col, u_accent, amt * (0.08 + 0.34 * weave));
  col += u_accent * amt * 0.015;

  // A whisper of living grain, time-derived so it stays deterministic.
  col += (hash(gl_FragCoord.xy + floor(u_time * 9.0)) - 0.5) * 0.012;

  fragColor = vec4(col, 1.0);
}
`;
