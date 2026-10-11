import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { presetValues, vendoredPresets } from "@/scripts/shader-presets";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import {
  EXCLUDED_SHADER_PRESETS,
  SHADER_PRESETS,
  shaderCatalogueEntry,
} from "./shader-presets";
import { MESH_GRADIENT, presetProblem, shaderCreation } from "./shaders";

describe("the shader preset catalogue", () => {
  it("is exactly what the vendored presets produce, each described or excluded", async () => {
    const vendored = await vendoredPresets(resolve("remocn"));
    expect({
      excluded: EXCLUDED_SHADER_PRESETS,
      presets: SHADER_PRESETS,
    }).toEqual(vendored);
    expect(vendored.presets.length + vendored.excluded.length).toBe(36);
  });

  it("excludes Warp Cream for the softness its shader cannot take", () => {
    expect(EXCLUDED_SHADER_PRESETS).toEqual([
      {
        reason: "Warp Cream: Softness must be at most 1.",
        slug: "shader-warp-cream",
      },
    ]);
    expect(shaderCatalogueEntry("shader-warp-cream")).toBeNull();
  });
});

describe("shaderCatalogueEntry", () => {
  it("resolves a shader to itself with its own defaults", () => {
    expect(shaderCatalogueEntry("shader-mesh-gradient")).toEqual({
      descriptor: MESH_GRADIENT,
      title: "Mesh Gradient",
      values: {},
    });
  });

  it("resolves a preset to its shader, its name and its values", () => {
    const entry = shaderCatalogueEntry("shader-mesh-gradient-aurora");
    expect(entry?.descriptor).toBe(MESH_GRADIENT);
    expect(entry?.title).toBe("Mesh Gradient Aurora");
    expect(entry?.values).toEqual({
      colors: ["#020617", "#0ea5a4", "#22d3ee", "#7c3aed", "#020617"],
      distortion: 1,
      rotation: 270,
      speed: 1,
      swirl: 0.8,
    });
  });

  it("answers nothing for a name it does not know", () => {
    expect(shaderCatalogueEntry("shader-warp-plaid")).toBeNull();
  });

  it("starts a preset instance from its values and the shader's defaults for the rest", () => {
    const entry = shaderCatalogueEntry("shader-mesh-gradient-aurora");
    if (!entry) {
      throw new Error("Aurora is not described");
    }
    const { object } = shaderCreation(
      entry.descriptor,
      shaderTargetFixture,
      "operation-1",
      "shader-1",
      0,
      entry
    );
    expect(object.label).toBe("Mesh Gradient Aurora");
    expect(object.shader?.slug).toBe("shader-mesh-gradient");
    expect(object.values.swirl).toBe(0.8);
    expect(object.values.grainOverlay).toBe(0);
    expect(object.values.endFrame).toBe(shaderTargetFixture.durationInFrames);
    expect(object.values.opacity).toBe(1);
  });
});

describe("presetProblem", () => {
  const preset = (values: Record<string, unknown>, base = "shader-warp") =>
    presetProblem({
      base,
      title: "Warp Test",
      values: values as never,
    });

  it("accepts values its shader declares", () => {
    expect(preset({ shape: "edge", softness: 1, speed: 2 })).toBeNull();
  });

  it("refuses a shader Studio cannot add", () => {
    expect(preset({}, "shader-plaid")).toBe(
      "Warp Test starts from a shader Studio cannot add."
    );
  });

  it("refuses a layer property and an unknown control", () => {
    expect(preset({ opacity: 0.5 })).toBe(
      "Warp Test sets opacity, which is not a Warp control."
    );
    expect(preset({ glow: 1 })).toBe(
      "Warp Test sets glow, which is not a Warp control."
    );
  });

  it("refuses an out-of-bounds number, an unknown option and too many colors", () => {
    expect(preset({ softness: 1.5 })).toBe(
      "Warp Test: Softness must be at most 1."
    );
    expect(preset({ shape: "plaid" })).toBe(
      "Warp Test: Choose one of the options for Shape."
    );
    expect(
      preset({ colors: Array.from({ length: 11 }, () => "#000000") })
    ).toStartWith("Warp Test: ");
  });
});

describe("presetValues", () => {
  it("reads the preset object of a vendored preset", () => {
    const source = `"use client";

export const shaderWarpSilkPreset = {
  speed: 2,
  shape: "edge",
  colors: ["#1b1033", "#6d3bd8"],
  proportion: 0.45,
} satisfies ShaderWarpProps;

export function ShaderWarpSilk() {}
`;
    expect(presetValues("shader-warp-silk", source)).toEqual({
      colors: ["#1b1033", "#6d3bd8"],
      proportion: 0.45,
      shape: "edge",
      speed: 2,
    });
  });

  it("fails by name when there is no preset object", () => {
    expect(() =>
      presetValues("shader-warp-silk", "export function A() {}")
    ).toThrow("shader-warp-silk: no exported preset object");
  });
});
