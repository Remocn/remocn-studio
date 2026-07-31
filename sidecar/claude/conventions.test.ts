import { describe, expect, it } from "vitest";
import {
  conventionsFor,
  STUDIO_CONVENTIONS,
} from "@/sidecar/claude/conventions";
import { LESSONS_SKILL } from "@/sidecar/claude/knowledge";

const NAMED = `remocn-studio:${LESSONS_SKILL}`;

describe("conventionsFor", () => {
  it("orders the lessons skill by the name the plugin ships it under", () => {
    expect(conventionsFor(true)).toContain(NAMED);
  });

  it("says the lessons outrank a general Remotion habit", () => {
    expect(conventionsFor(true)).toContain("it wins");
  });

  it("never orders a skill that is not loaded", () => {
    const alone = conventionsFor(false);

    expect(alone).toBe(STUDIO_CONVENTIONS);
    expect(alone).not.toContain(NAMED);
    expect(alone).not.toContain(LESSONS_SKILL);
  });

  it("keeps the app's own conventions either way", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("exactly one composition");
      expect(text).toContain("[Element #N]");
    }
  });
});
