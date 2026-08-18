import { describe, expect, it } from "vitest";
import { firstPlaceholder, PROMPT_TEMPLATES } from "@/lib/studio/templates";
import { countsOf, segmentsOf } from "@/shared/references";

const GENEROUS = countsOf({ asset: 9, element: 9, image: 9 });

describe("PROMPT_TEMPLATES", () => {
  it("carries eight templates with unique ids", () => {
    expect(PROMPT_TEMPLATES).toHaveLength(8);
    const ids = new Set(PROMPT_TEMPLATES.map((template) => template.id));
    expect(ids.size).toBe(PROMPT_TEMPLATES.length);
  });

  it("gives every template a title, a description and a placeholder to land on", () => {
    for (const template of PROMPT_TEMPLATES) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(firstPlaceholder(template.prompt)).not.toBeNull();
    }
  });

  it("keeps every prompt clear of the reference vocabulary", () => {
    for (const template of PROMPT_TEMPLATES) {
      const segments = segmentsOf(template.prompt, GENEROUS);
      expect(segments).toHaveLength(1);
      expect(segments[0]?.kind).toBe("text");
    }
  });
});

describe("firstPlaceholder", () => {
  it("finds the first bracketed span", () => {
    const found = firstPlaceholder("Make a demo for [product name] today");
    expect(found).toEqual({ end: 30, start: 16 });
  });

  it("returns null when there is nothing to replace", () => {
    expect(firstPlaceholder("Make a demo")).toBeNull();
  });

  it("does not treat a bracket torn across lines as a placeholder", () => {
    expect(firstPlaceholder("open [\nclose]")).toBeNull();
  });
});
