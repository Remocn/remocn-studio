// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELEMENT_ROLES,
  isElementRole,
  isMotionRole,
  MOTION_DICTIONARY,
  MOTION_ROLES,
  ROLE_HINTS,
  ROLE_LABELS,
  ROLE_PARAMETERS,
} from "@/shared/motion";

const SKILL = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "agent",
    "skills",
    "motion-design",
    "SKILL.md"
  ),
  "utf8"
);

const NAMES = ELEMENT_ROLES.flatMap((role) => MOTION_DICTIONARY[role]);

const KEBAB = /^[a-z]+(-[a-z]+)*$/;

describe("the roles", () => {
  it("reads in the order a life runs, with the two whole-scene answers last", () => {
    expect(MOTION_ROLES).toEqual([
      "entry",
      "emphasis",
      "exit",
      "scene",
      "transition",
    ]);
  });

  it("gives every role a label, a hint and the props it expects", () => {
    for (const role of MOTION_ROLES) {
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
      expect(ROLE_HINTS[role].length).toBeGreaterThan(0);
      expect(ROLE_PARAMETERS[role].length).toBeGreaterThan(0);
    }
  });

  it("mirrors an exit on its entry, which is what makes the pair one decision", () => {
    expect(ROLE_PARAMETERS.exit).toEqual(ROLE_PARAMETERS.entry);
  });

  it("counts entry, emphasis and exit as the roles an element itself has", () => {
    expect(isElementRole("entry")).toBe(true);
    expect(isElementRole("scene")).toBe(false);
    expect(isElementRole("transition")).toBe(false);
  });

  it("recognises a role only by its own spelling", () => {
    expect(isMotionRole("emphasis")).toBe(true);
    expect(isMotionRole("entrance")).toBe(false);
    expect(isMotionRole(null)).toBe(false);
  });
});

describe("the dictionary", () => {
  it("names every behaviour once, in kebab-case", () => {
    expect(new Set(NAMES).size).toBe(NAMES.length);
    for (const name of NAMES) {
      expect(name).toMatch(KEBAB);
    }
  });

  it("mirrors every exit on an entry of the same name", () => {
    for (const name of MOTION_DICTIONARY.exit) {
      expect(MOTION_DICTIONARY.entry).toContain(name.replace("-out", "-in"));
    }
  });

  it("is documented name by name in the motion-design skill", () => {
    for (const name of NAMES) {
      expect(SKILL).toContain(`\`${name}\``);
    }
  });
});
