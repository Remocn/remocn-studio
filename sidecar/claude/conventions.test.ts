import { describe, expect, it } from "vitest";
import {
  BUNDLE_NAME,
  INTERACTIVITY_SKILL,
  LESSONS_SKILL,
  MOTION_SKILL,
  SHIPPED,
} from "@/sidecar/agent/knowledge";
import {
  conventionsFor,
  STUDIO_CONVENTIONS,
} from "@/sidecar/claude/conventions";

const NAMED = `\`${LESSONS_SKILL}\``;
const MARKUP = `\`${INTERACTIVITY_SKILL}\``;
const MOTION = `\`${MOTION_SKILL}\``;

describe("conventionsFor", () => {
  it("orders the lessons skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(NAMED);
  });

  it("names the bundle and every skill in it, so any runtime's catalog matches", () => {
    const text = conventionsFor(true);

    expect(text).toContain(`\`${BUNDLE_NAME}\``);
    for (const skill of SHIPPED) {
      expect(text).toContain(skill);
    }
  });

  it("orders a skill in words no single runtime owns", () => {
    const text = conventionsFor(true);

    expect(text).not.toContain(`${BUNDLE_NAME}:${LESSONS_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${MOTION_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${INTERACTIVITY_SKILL}`);
  });

  it("says the lessons outrank a general Remotion habit", () => {
    expect(conventionsFor(true)).toContain("it wins");
  });

  it("orders the interactivity skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(MARKUP);
  });

  it("orders the motion-design skill by the name the bundle ships it under", () => {
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
    expect(alone).not.toContain(BUNDLE_NAME);
  });

  it("keeps the app's own conventions either way", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("exactly one composition");
      expect(text).toContain("[Element #N]");
      expect(text).toContain("mcp__remocn-design__design_check");
      expect(text).toContain("fix every mechanical finding");
    }
  });

  it("keeps the motion-design baseline even without bundled skills", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("Unless the project's brand");
      expect(compact).toContain("gradient text");
      expect(compact).toContain("headings at least 64px");
      expect(compact).toContain("body at least 28px");
      expect(compact).toContain("background, midground and foreground");
      expect(compact).toContain("two to five decorative elements");
      expect(compact).toContain("shared slow motion");
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
