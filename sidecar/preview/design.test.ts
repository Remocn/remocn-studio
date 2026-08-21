// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type BrowserDesignFinding,
  composite,
  contrastRatio,
  finishDesignResult,
  type MotionAssertion,
  type MotionProbe,
  type MotionSample,
  type MotionTargetState,
  motionFindings,
  motionFrames,
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
      assertions: [],
      audits: [
        {
          audit: { findings: [finding()], fingerprint: "first", motion: [] },
          frame: 30,
        },
        {
          audit: {
            findings: [finding({ frame: 90 })],
            fingerprint: "second",
            motion: [],
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
      assertions: [],
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
            motion: [],
          },
          frame: 30,
        },
        {
          audit: { findings: [], fingerprint: "second", motion: [] },
          frame: 90,
        },
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
      assertions: [],
      audits: [
        { audit: { findings: [], fingerprint: "same", motion: [] }, frame: 30 },
        { audit: { findings: [], fingerprint: "same", motion: [] }, frame: 90 },
      ],
      composition: "Main",
      height: 1080,
      snapshots: [],
      width: 1920,
    });
    const moving = finishDesignResult({
      assertions: [],
      audits: [
        {
          audit: { findings: [], fingerprint: "first", motion: [] },
          frame: 30,
        },
        {
          audit: { findings: [], fingerprint: "second", motion: [] },
          frame: 90,
        },
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

describe("motionFindings", () => {
  const target = (
    shape: Partial<MotionTargetState> = {}
  ): MotionTargetState => ({
    bbox: { height: 100, width: 100, x: 200, y: 200 },
    designId: null,
    display: true,
    fingerprint: "state-a",
    inFrame: true,
    opacity: 1,
    pixels: null,
    sized: true,
    visible: true,
    ...shape,
  });
  const one = (shape: Partial<MotionTargetState> = {}): MotionProbe => ({
    matches: 1,
    target: target(shape),
  });
  const none: MotionProbe = { matches: 0, target: null };

  const evaluate = (
    assertions: readonly MotionAssertion[],
    samples: readonly MotionSample[]
  ) => motionFindings({ assertions, height: 1080, samples, width: 1920 });

  it("collects the frames every assertion needs to sample", () => {
    expect(
      motionFrames([
        { from: 30, kind: "changes_between", selector: ".orb", to: 90 },
        { frame: 60, kind: "visible_at", selector: ".headline" },
        { kind: "stays_in_frame", selector: ".ticker" },
      ])
    ).toEqual([30, 90, 60]);
  });

  it("reports a selector that matched nothing instead of passing silently", () => {
    const findings = evaluate(
      [{ frame: 60, kind: "visible_at", selector: "[data-design-id='gone']" }],
      [{ frame: 60, probes: [none] }]
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "motion_target_missing",
      frames: [60],
      selector: "[data-design-id='gone']",
      severity: "error",
    });
  });

  it("reports an ambiguous selector as its own finding", () => {
    const findings = evaluate(
      [{ from: 30, kind: "changes_between", selector: ".card", to: 90 }],
      [
        { frame: 30, probes: [{ matches: 3, target: null }] },
        { frame: 90, probes: [{ matches: 3, target: null }] },
      ]
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "motion_target_ambiguous",
      frames: [30, 90],
      severity: "warning",
    });
    expect(findings[0]?.message).toContain("3 elements");
  });

  it("fails changes_between when geometry and pixels are both identical", () => {
    const findings = evaluate(
      [{ from: 30, kind: "changes_between", selector: ".orb", to: 90 }],
      [
        { frame: 30, probes: [one({ pixels: "p1" })] },
        { frame: 90, probes: [one({ pixels: "p1" })] },
      ]
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      bbox: { height: 100, width: 100, x: 200, y: 200 },
      code: "motion_static",
      frames: [30, 90],
      severity: "error",
    });
  });

  it("passes changes_between when only the pixel content changed", () => {
    const findings = evaluate(
      [{ from: 30, kind: "changes_between", selector: "canvas", to: 90 }],
      [
        { frame: 30, probes: [one({ pixels: "p1" })] },
        { frame: 90, probes: [one({ pixels: "p2" })] },
      ]
    );

    expect(findings).toEqual([]);
  });

  it("passes changes_between when the geometry fingerprint changed", () => {
    const findings = evaluate(
      [{ from: 30, kind: "changes_between", selector: ".orb", to: 90 }],
      [
        { frame: 30, probes: [one({ fingerprint: "state-a" })] },
        { frame: 90, probes: [one({ fingerprint: "state-b" })] },
      ]
    );

    expect(findings).toEqual([]);
  });

  it("names every property that keeps a visible_at element hidden", () => {
    const findings = evaluate(
      [{ frame: 60, kind: "visible_at", selector: ".headline" }],
      [
        {
          frame: 60,
          probes: [one({ designId: "headline", inFrame: false, opacity: 0 })],
        },
      ]
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "motion_not_visible",
      frames: [60],
      severity: "error",
    });
    expect(findings[0]?.observed).toContain("opacity");
    expect(findings[0]?.observed).toContain("outside the canvas");
    expect(findings[0]?.observed).toContain('data-design-id="headline"');
  });

  it("accepts a visible_at element that is displayed, sized and on canvas", () => {
    const findings = evaluate(
      [{ frame: 60, kind: "visible_at", selector: ".headline" }],
      [{ frame: 60, probes: [one()] }]
    );

    expect(findings).toEqual([]);
  });

  it("returns the exit coordinates when an element leaves the canvas", () => {
    const findings = evaluate(
      [{ kind: "stays_in_frame", selector: ".ticker" }],
      [
        { frame: 30, probes: [one()] },
        {
          frame: 90,
          probes: [one({ bbox: { height: 100, width: 400, x: 1700, y: -30 } })],
        },
      ]
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "motion_out_of_frame",
      frames: [90],
      severity: "error",
    });
    expect(findings[0]?.observed).toContain("180px past the right edge");
    expect(findings[0]?.observed).toContain("30px past the top edge");
  });

  it("lets stays_in_frame skip frames where the element is absent or hidden", () => {
    const findings = evaluate(
      [{ kind: "stays_in_frame", selector: ".ticker" }],
      [
        { frame: 30, probes: [none] },
        {
          frame: 90,
          probes: [
            one({
              bbox: { height: 100, width: 400, x: 1700, y: 0 },
              opacity: 0,
            }),
          ],
        },
      ]
    );

    expect(findings).toEqual([]);
  });

  it("still reports a stays_in_frame selector that never matched", () => {
    const findings = evaluate(
      [{ kind: "stays_in_frame", selector: ".ticker" }],
      [
        { frame: 30, probes: [none] },
        { frame: 90, probes: [none] },
      ]
    );

    expect(findings[0]).toMatchObject({ code: "motion_target_missing" });
  });

  it("feeds motion findings into the summary through finishDesignResult", () => {
    const result = finishDesignResult({
      assertions: [
        { from: 30, kind: "changes_between", selector: ".orb", to: 90 },
      ],
      audits: [
        {
          audit: { findings: [], fingerprint: "first", motion: [one()] },
          frame: 30,
        },
        {
          audit: { findings: [], fingerprint: "second", motion: [one()] },
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
      code: "motion_static",
      severity: "error",
    });
    expect(result.summary.errors).toBe(1);
  });
});
