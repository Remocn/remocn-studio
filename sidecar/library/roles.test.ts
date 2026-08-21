// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isMotionRole } from "@/shared/motion";
import { BUNDLED_ROLES, bundledRoleOf } from "./roles";

const shipped: readonly string[] = (
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, "..", "..", "remocn", "index.json"),
      "utf8"
    )
  ) as { components: readonly string[] }
).components;

describe("bundledRoleOf", () => {
  it("classifies every component the vendored set ships", () => {
    expect(shipped.filter((name) => bundledRoleOf(name) === null)).toEqual([]);
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
