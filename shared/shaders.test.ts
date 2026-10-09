import { describe, expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { ShaderTarget, shaderTargetsAtFrame } from "./shader-target";
import {
  MESH_GRADIENT,
  SHADER_DESCRIPTORS,
  ShaderDescriptor,
  shaderCreation,
} from "./shaders";
import {
  fieldProblem,
  fieldUnavailableReason,
  StudioDocument,
} from "./studio-document";

describe("shader descriptors", () => {
  const decode = Schema.decodeUnknownExit(ShaderDescriptor, {
    onExcessProperty: "error",
  });
  it.each([...SHADER_DESCRIPTORS])(
    "validates defaults and every control boundary for $slug",
    (descriptor) => {
      expect(Exit.isSuccess(decode(descriptor))).toBe(true);
      const operation = shaderCreation(
        descriptor,
        shaderTargetFixture,
        "create",
        "shader",
        0
      );
      for (const field of descriptor.definition.fields) {
        expect(
          fieldProblem(field, operation.object.values[field.id])
        ).toBeNull();
        if (field.type === "number") {
          if (field.min !== undefined) {
            expect(fieldProblem(field, field.min - 1)).not.toBeNull();
          }
          if (field.max !== undefined) {
            expect(fieldProblem(field, field.max + 1)).not.toBeNull();
          }
          if (field.integer) {
            expect(
              fieldProblem(field, Number(field.default) + 0.5)
            ).not.toBeNull();
          }
        } else if (field.type === "enum") {
          expect(fieldProblem(field, "unsupported-option")).not.toBeNull();
        } else if (field.type === "palette") {
          expect(fieldProblem(field, [])).not.toBeNull();
          expect(
            fieldProblem(
              field,
              Array.from(
                { length: Number(field.maxItems) + 1 },
                () => "#ffffff"
              )
            )
          ).not.toBeNull();
          expect(
            fieldProblem(
              field,
              (field.default as readonly string[]).map(() => "not-a-color")
            )
          ).not.toBeNull();
        }
      }
    }
  );
  it("creates complete independent Mesh Gradient instances from the pinned defaults", () => {
    const first = shaderCreation(
      MESH_GRADIENT,
      shaderTargetFixture,
      "insert-1",
      "shader-1",
      0
    );
    const second = shaderCreation(
      MESH_GRADIENT,
      shaderTargetFixture,
      "insert-2",
      "shader-2",
      1
    );
    expect(first.object.id).not.toBe(second.object.id);
    expect(first.object.values).toMatchObject({
      colors: ["#12121a", "#232338", "#3a3a5c", "#52527a"],
      distortion: 0.6,
      endFrame: 150,
      followSceneEnd: true,
      swirl: 0.1,
    });
    expect(
      Exit.isSuccess(
        Schema.decodeUnknownExit(StudioDocument)({
          definitions: [first.definition],
          objects: [first.object, second.object],
          operations: [],
          version: 1,
          video: "intro",
        })
      )
    ).toBe(true);
  });
  it("rejects unsupported versions, unknown fields, invalid ranges and dependency references", () => {
    const [, field] = MESH_GRADIENT.definition.fields;
    const withField = (patch: object) => ({
      ...MESH_GRADIENT,
      definition: {
        ...MESH_GRADIENT.definition,
        fields: [{ ...field, ...patch }],
      },
    });
    for (const invalid of [
      { ...MESH_GRADIENT, version: 2 },
      { ...MESH_GRADIENT, packageVersion: "99.0.0" },
      { ...MESH_GRADIENT, unknown: true },
      withField({ max: 1, min: 2 }),
      withField({ default: 2 }),
      withField({ minItems: 2 }),
      withField({
        availableWhen: {
          field: "missing",
          operator: "equals",
          reason: "Missing",
          value: 1,
        },
      }),
      withField({
        availableWhen: {
          field: field.id,
          operator: "greaterThan",
          reason: "Cycle",
          value: 1,
        },
      }),
    ]) {
      expect(Exit.isFailure(decode(invalid))).toBe(true);
    }
  });
  it("checks numeric bounds and explains inactive controls without resetting values", () => {
    const scale = MESH_GRADIENT.definition.fields.find(
      (field) => field.id === "scale"
    );
    const end = MESH_GRADIENT.definition.fields.find(
      (field) => field.id === "endFrame"
    );
    if (!(scale && end)) {
      throw new Error("Missing controls");
    }
    expect(fieldProblem(scale, 0)).not.toBeNull();
    expect(fieldProblem(scale, 4)).toBeNull();
    expect(fieldProblem(end, 1.5)).not.toBeNull();
    expect(
      fieldUnavailableReason(end, { endFrame: 120, followSceneEnd: true })
    ).toContain("Follow scene end");
    expect(
      fieldUnavailableReason(end, { endFrame: 120, followSceneEnd: false })
    ).toBeNull();
  });
  it("uses half-open frame ranges and exposes overlaps instead of guessing", () => {
    const later = {
      ...shaderTargetFixture,
      from: 100,
      sceneId: "scene-2",
      slotId: "later",
    };
    expect(
      shaderTargetsAtFrame([shaderTargetFixture, later], 100)
    ).toHaveLength(2);
    expect(shaderTargetsAtFrame([shaderTargetFixture, later], 150)).toEqual([
      later,
    ]);
    expect(shaderTargetsAtFrame([shaderTargetFixture, later], 250)).toEqual([]);
    expect(
      Exit.isFailure(
        Schema.decodeUnknownExit(ShaderTarget)({ ...later, fps: 0 })
      )
    ).toBe(true);
  });
});
