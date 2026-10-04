import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { review } from "@/sidecar/claude/permission";
import { STUDIO_CONVENTIONS, stageBrief } from "../agent/instructions";
import {
  DESIGN_CHECK,
  DESIGN_SERVER,
  GET_MOODBOARD,
  LIBRARY_SERVER,
  PIPELINE_SERVER,
  REQUEST_SOURCE_ASSET,
  SAVE_MOODBOARD,
  SEARCH_STOCK,
  SET_PIPELINE_STAGE,
  START_PIPELINE,
  TOOL_SERVERS,
  TOOL_SPECS,
} from "./specs";

const pipelineBrief = (stages: Parameters<typeof stageBrief>[0]) =>
  stageBrief(stages, { planningTool: "TaskCreate", video: null });

describe("tool specs", () => {
  it("keeps every tool auto-allowed by the permission gate", async () => {
    const named = TOOL_SERVERS.flatMap((server) =>
      TOOL_SPECS[server].map((spec) => `mcp__${server}__${spec.name}`)
    );

    const verdicts = await Promise.all(
      named.map((tool) => Effect.runPromise(review("/videos/promo", tool, {})))
    );

    for (const [index, verdict] of verdicts.entries()) {
      expect(verdict, named[index]).toEqual({ kind: "allow" });
    }
  });

  it("names the same tools the system prompt tells the agent to call", () => {
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${DESIGN_SERVER}__${DESIGN_CHECK}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${PIPELINE_SERVER}__${START_PIPELINE}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${PIPELINE_SERVER}__${SET_PIPELINE_STAGE}`
    );
    expect(pipelineBrief([{ stage: "analysis", status: "active" }])).toContain(
      `mcp__${PIPELINE_SERVER}__${SET_PIPELINE_STAGE}`
    );
    expect(pipelineBrief([{ stage: "brand", status: "active" }])).toContain(
      `mcp__${PIPELINE_SERVER}__${REQUEST_SOURCE_ASSET}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${LIBRARY_SERVER}__${GET_MOODBOARD}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${LIBRARY_SERVER}__${SEARCH_STOCK}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${LIBRARY_SERVER}__${SAVE_MOODBOARD}`
    );
    for (const tool of [GET_MOODBOARD, SEARCH_STOCK, SAVE_MOODBOARD]) {
      expect(pipelineBrief([{ stage: "brand", status: "active" }])).toContain(
        `mcp__${LIBRARY_SERVER}__${tool}`
      );
    }
  });

  it("carries the three servers the conventions and gate were written for", () => {
    expect([...TOOL_SERVERS].sort()).toEqual([
      DESIGN_SERVER,
      LIBRARY_SERVER,
      PIPELINE_SERVER,
    ]);
  });
});
