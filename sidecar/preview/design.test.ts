// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type BrowserDesignFinding,
  composite,
  contrastRatio,
  finishDesignResult,
  parseCssColor,
  requiredContrastRatio,
} from "./design";

const box = { height: 40, width: 200, x: 100, y: 50 };

function color(value: string) {
  const parsed = parseCssColor(value);
  if (parsed === null) {
    throw new Error(`could not parse ${value}`);
  }
  return parsed;
}

function finding(
  shape: Partial<BrowserDesignFinding> = {}
): BrowserDesignFinding {
  return {
    bbox: box,
    code: "contrast_aa_failure",
    expected: "4.5:1",
    fix: "brighten it",
    frame: 30,
    message: "contrast is low",
    observed: "2:1",
    selector: "#title",
    text: "Hello",
    type: "contrast",
    ...shape,
  };
}

describe("design contrast", () => {
  it("parses computed rgb and rgba colours", () => {
    expect(parseCssColor("rgb(12, 34, 56)")).toEqual({
      a: 1,
      b: 56,
      g: 34,
      r: 12,
    });
    expect(parseCssColor("rgba(255, 0, 10, 0.4)")).toEqual({
      a: 0.4,
      b: 10,
      g: 0,
      r: 255,
    });
  });

  it("computes the WCAG black-on-white ratio", () => {
    expect(
      contrastRatio(color("rgb(0, 0, 0)"), color("rgb(255, 255, 255)"))
    ).toBe(21);
  });

  it("composites translucent paint before measuring it", () => {
    expect(
      composite(color("rgba(255, 255, 255, 0.5)"), color("rgb(0, 0, 0)"))
    ).toEqual({
      a: 1,
      b: 128,
      g: 128,
      r: 128,
    });
  });

  it("uses the WCAG large-text boundaries", () => {
    expect(requiredContrastRatio(23.9, 400)).toBe(4.5);
    expect(requiredContrastRatio(24, 400)).toBe(3);
    expect(requiredContrastRatio(18.9, 700)).toBe(4.5);
    expect(requiredContrastRatio(19, 700)).toBe(3);
  });
});

describe("finishDesignResult", () => {
  it("promotes a held contrast failure and collapses its frames", () => {
    const result = finishDesignResult({
      audits: [
        {
          audit: { findings: [finding()], fingerprint: "first" },
          frame: 30,
        },
        {
          audit: {
            findings: [finding({ frame: 90 })],
            fingerprint: "second",
          },
          frame: 90,
        },
      ],
      composition: "Main",
      height: 1080,
      snapshots: [],
      width: 1920,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      code: "contrast_aa_failure",
      frames: [30, 90],
      severity: "error",
    });
    expect(result.summary).toEqual({ errors: 1, info: 0, warnings: 0 });
  });

  it("keeps a one-frame layer issue informational", () => {
    const result = finishDesignResult({
      audits: [
        {
          audit: {
            findings: [
              finding({
                code: "text_clipped",
                type: "layer",
              }),
            ],
            fingerprint: "first",
          },
          frame: 30,
        },
        { audit: { findings: [], fingerprint: "second" }, frame: 90 },
      ],
      composition: "Main",
      height: 1080,
      snapshots: [],
      width: 1920,
    });

    expect(result.findings[0]?.severity).toBe("info");
  });

  it("warns only when every sampled fingerprint is identical", () => {
    const frozen = finishDesignResult({
      audits: [
        { audit: { findings: [], fingerprint: "same" }, frame: 30 },
        { audit: { findings: [], fingerprint: "same" }, frame: 90 },
      ],
      composition: "Main",
      height: 1080,
      snapshots: [],
      width: 1920,
    });
    const moving = finishDesignResult({
      audits: [
        { audit: { findings: [], fingerprint: "first" }, frame: 30 },
        { audit: { findings: [], fingerprint: "second" }, frame: 90 },
      ],
      composition: "Main",
      height: 1080,
      snapshots: [],
      width: 1920,
    });

    expect(frozen.findings[0]).toMatchObject({
      code: "timeline_static",
      frames: [30, 90],
      severity: "warning",
    });
    expect(moving.findings).toEqual([]);
  });
});
