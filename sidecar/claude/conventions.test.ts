import { describe, expect, it } from "vitest";
import {
  conventionsFor,
  STUDIO_CONVENTIONS,
} from "@/sidecar/claude/conventions";
import {
  INTERACTIVITY_SKILL,
  LESSONS_SKILL,
  MOTION_SKILL,
} from "@/sidecar/claude/knowledge";

const NAMED = `remocn-studio:${LESSONS_SKILL}`;
const MARKUP = `remocn-studio:${INTERACTIVITY_SKILL}`;
const MOTION = `remocn-studio:${MOTION_SKILL}`;

describe("conventionsFor", () => {
  it("orders the lessons skill by the name the plugin ships it under", () => {
    expect(conventionsFor(true)).toContain(NAMED);
  });

  it("says the lessons outrank a general Remotion habit", () => {
    expect(conventionsFor(true)).toContain("it wins");
  });

  it("orders the interactivity skill by the name the plugin ships it under", () => {
    expect(conventionsFor(true)).toContain(MARKUP);
  });

  it("orders the motion-design skill by the name the plugin ships it under", () => {
    expect(conventionsFor(true)).toContain(MOTION);
  });

  it("says the lessons outrank the motion-design defaults", () => {
    expect(conventionsFor(true)).toContain("the lessons win");
  });

  it("never orders a skill that is not loaded", () => {
    const alone = conventionsFor(false);

    expect(alone).toBe(STUDIO_CONVENTIONS);
    expect(alone).not.toContain(NAMED);
    expect(alone).not.toContain(LESSONS_SKILL);
    expect(alone).not.toContain(MARKUP);
    expect(alone).not.toContain(MOTION);
    expect(alone).not.toContain(MOTION_SKILL);
  });

  it("keeps the app's own conventions either way", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("exactly one composition");
      expect(text).toContain("[Element #N]");
    }
  });

  it("requires a parameter schema with or without the plugin", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("Zod schema");
      expect(text).toContain("zColor()");
      expect(text).toContain("InteractivitySchema");
      expect(text).toContain("unless the person asks");
    }
  });
});
