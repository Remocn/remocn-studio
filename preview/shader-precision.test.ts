import { expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import shaderPrecisionLoader from "./shader-precision-loader.cjs";

it("ships the native compatibility loader in the desktop bundle", async () => {
  const config = JSON.parse(
    await readFile("src-tauri/tauri.conf.json", "utf8")
  );
  expect(
    config.bundle.resources["../preview/shader-precision-loader.cjs"]
  ).toBe("preview/shader-precision-loader.cjs");
});

const PRECISION = /precision (\w+) float;/;
function uniforms(source: string) {
  const defaultPrecision = source.match(PRECISION)?.[1];
  return new Map(
    [
      ...source.matchAll(
        /uniform (?:(lowp|mediump|highp) )?(float|vec[234]) (\w+);/g
      ),
    ].map((match) => [match[3], match[1] ?? defaultPrecision])
  );
}
const promoted = (source: string) =>
  source
    .replace(/precision\s+(lowp|mediump)\s+float/g, "precision highp float")
    .replace(
      /\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,
      "$1 highp $3"
    );

it.each(["caustics", "strata", "weave"])(
  "links %s shared uniforms at both Paper precision branches",
  async (name) => {
    const [fragment, vertex] = await Promise.all([
      readFile(
        `templates/remotion/src/lib/studio-shaders-v1/${name}-fragment.ts`,
        "utf8"
      ),
      readFile(
        "node_modules/@paper-design/shaders/dist/vertex-shader.js",
        "utf8"
      ),
    ]);
    const fixed = shaderPrecisionLoader(fragment);
    expect(fixed).toContain("precision highp float;");
    expect(uniforms(fragment).get("u_resolution")).toBe("highp");
    expect(shaderPrecisionLoader(fixed)).toBe(fixed);
    for (const promote of [false, true]) {
      const vertexUniforms = uniforms(promote ? promoted(vertex) : vertex);
      const fragmentUniforms = uniforms(promote ? promoted(fixed) : fixed);
      for (const [id, precision] of fragmentUniforms) {
        if (vertexUniforms.has(id)) {
          expect({ id, precision }).toEqual({
            id,
            precision: vertexUniforms.get(id),
          });
        }
      }
    }
    // Only qualifiers change: equations, clocks and authored defaults stay intact.
    expect(fixed.replaceAll("uniform mediump ", "uniform ")).toBe(fragment);
  }
);

it("leaves explicit precision and unrelated source unchanged", () => {
  const source =
    "uniform highp vec2 u_resolution; uniform float u_glow; // keep this";
  expect(shaderPrecisionLoader(source)).toBe(source);
});
