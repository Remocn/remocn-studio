import { describe, expect, it } from "bun:test";
import { makeFinding } from "../preview/readiness-analysis";
import type { ReadinessReport } from "../preview/readiness-contract";
import { executeTool, type TurnTools } from "./execute";
import { reviewCompletionProblem } from "./review";

function report(): ReadinessReport {
  return {
    checks: [
      { reason: "checked", rule: "motion_contract", status: "completed" },
    ],
    composition: "Main",
    context: {},
    coverage: {
      cancelled: false,
      complete: true,
      durationInFrames: 90,
      elapsedMs: 100,
      exhaustive: false,
      failed: [],
      fps: 30,
      limitations: [],
      motion: {
        boundaries: [0, 45, 89],
        contracts: 1,
        cues: 2,
        invalid: [],
        uncovered: [],
        unvisited: [],
      },
      peakRssBytes: 0,
      planned: 3,
      sampled: [0, 45, 89],
      strategy: "scene_aware_sampled",
      unmeasuredIntervals: [],
    },
    createdAt: "2026-09-10T00:00:00Z",
    findings: [],
    height: 720,
    id: "00000000-0000-4000-8000-000000000001",
    options: {},
    path: "/out/report.json",
    project: "/project",
    props: {},
    revision: "current",
    stale: false,
    width: 1280,
  };
}

describe("agent review completion", () => {
  it("requires a current complete report with checked runtime boundaries", () => {
    const ready = report();
    expect(reviewCompletionProblem(ready)).toBeNull();
    expect(reviewCompletionProblem(undefined)).not.toBeNull();
    expect(reviewCompletionProblem({ ...ready, stale: true })).not.toBeNull();
    expect(
      reviewCompletionProblem({
        ...ready,
        coverage: { ...ready.coverage, complete: false },
      })
    ).not.toBeNull();
    expect(
      reviewCompletionProblem({
        ...ready,
        coverage: { ...ready.coverage, motion: undefined },
      })
    ).not.toBeNull();
    expect(
      reviewCompletionProblem({
        ...ready,
        coverage: {
          ...ready.coverage,
          motion: {
            boundaries: [0, 45, 89],
            contracts: 1,
            cues: 2,
            invalid: [],
            unvisited: [45],
          },
        },
      })
    ).not.toBeNull();
  });

  it("keeps measured errors open without turning creative heuristics into an export rule", () => {
    const ready = report();
    const error = makeFinding({
      category: "motion_contract",
      code: "motion_contract_target",
      conclusion: "measurement",
      from: 40,
      message: "caption removed",
      severity: "error",
      to: 41,
    });
    expect(
      reviewCompletionProblem({ ...ready, findings: [error] })
    ).not.toBeNull();
    expect(
      reviewCompletionProblem({
        ...ready,
        findings: [
          { ...error, exception: "Intentional cut, reviewed at this revision" },
        ],
      })
    ).toBeNull();
    expect(
      reviewCompletionProblem({
        ...ready,
        findings: [{ ...error, conclusion: "heuristic" }],
      })
    ).toBeNull();
  });

  it("reloads the report before advancing the stage and stops on new source changes", async () => {
    let writes = 0;
    let loaded = 0;
    let current = report();
    const tools: TurnTools = {
      connections: { usable: () => Promise.resolve([]) },
      cwd: "/project",
      design: {
        check: (input) => {
          expect(input.mode).toBe("report");
          expect(input.reportId).toBe(current.id);
          loaded += 1;
          return Promise.resolve({
            composition: "Main",
            findings: [],
            frames: [],
            height: 720,
            readiness: current,
            snapshots: [],
            summary: { errors: 0, info: 0, warnings: 0 },
            width: 1280,
          });
        },
        sources: async () => [],
      },
      library: {
        list: async () => [],
        save: () => Promise.reject(new Error("unused")),
      },
      moodboard: {
        find: async () => null,
        save: () => Promise.reject(new Error("unused")),
      },
      pipeline: {
        brief: () => "THE PORT'S BRIEF",
        requestSource: () => Promise.reject(new Error("unused")),
        setStage: () => {
          writes += 1;
          return Promise.resolve([]);
        },
        start: async () => [],
      },
      stock: {
        search: () => Promise.reject(new Error("unused")),
      },
    };
    const args = {
      reviewReportId: current.id,
      stage: "review",
      status: "done",
    };
    const done = await executeTool(
      "remocn-pipeline",
      "set_pipeline_stage",
      args,
      tools
    );
    expect(done.isError).toBe(false);
    expect(done.text).toBe("[]\n\nTHE PORT'S BRIEF");
    current = { ...current, stale: true };
    expect(
      (await executeTool("remocn-pipeline", "set_pipeline_stage", args, tools))
        .isError
    ).toBe(true);
    expect(loaded).toBe(2);
    expect(writes).toBe(1);
  });
});
