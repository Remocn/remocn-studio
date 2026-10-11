import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMotionRole } from "@/shared/motion";
import { BUNDLED_ROLES, bundledRoleOf } from "./roles";

const vendor = join(import.meta.dirname, "..", "..", "remocn");
const shipped: readonly string[] = (
  JSON.parse(readFileSync(join(vendor, "index.json"), "utf8")) as {
    components: readonly string[];
  }
).components;
const presetOf = (name: string): string | undefined =>
  (
    JSON.parse(
      readFileSync(join(vendor, "registry", name, "manifest.json"), "utf8")
    ) as { presetOf?: string }
  ).presetOf;

describe("bundledRoleOf", () => {
  it("classifies every component the vendored set ships", () => {
    expect(
      shipped.filter(
        (name) =>
          !name.startsWith("caption-") &&
          bundledRoleOf(name, presetOf(name)) === null
      )
    ).toEqual([]);
  });

  it("classifies nothing the vendored set does not ship", () => {
    expect(
      Object.keys(BUNDLED_ROLES).filter((name) => !shipped.includes(name))
    ).toEqual([]);
  });

  it("only ever answers with a role of the taxonomy", () => {
    for (const role of Object.values(BUNDLED_ROLES)) {
      expect(isMotionRole(role)).toBe(true);
    }
  });

  it("gives a preset the role of the shader it starts from", () => {
    expect(bundledRoleOf("shader-warp-silk", "shader-warp")).toBe("scene");
    expect(bundledRoleOf("shader-warp-silk")).toBeNull();
  });

  it("answers for a name nothing ships with no role rather than a guess", () => {
    expect(bundledRoleOf("nothing-of-the-sort")).toBeNull();
  });

  it("reads a scene transition as a transition and a backdrop as a scene", () => {
    expect(bundledRoleOf("whip-pan")).toBe("transition");
    expect(bundledRoleOf("shader-water")).toBe("scene");
    expect(bundledRoleOf("soft-blur-in")).toBe("entry");
    expect(bundledRoleOf("scale-down-fade")).toBe("exit");
    expect(bundledRoleOf("marker-highlight")).toBe("emphasis");
  });
});
