import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { review } from "@/sidecar/claude/permission";
import { pipelineBrief, STUDIO_CONVENTIONS } from "../claude/conventions";
import {
  LIBRARY_SERVER,
  PIPELINE_SERVER,
  SET_PIPELINE_STAGE,
  START_PIPELINE,
  TOOL_SERVERS,
  TOOL_SPECS,
} from "./specs";

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
      `mcp__${PIPELINE_SERVER}__${START_PIPELINE}`
    );
    expect(STUDIO_CONVENTIONS).toContain(
      `mcp__${PIPELINE_SERVER}__${SET_PIPELINE_STAGE}`
    );
    expect(pipelineBrief([{ stage: "analysis", status: "active" }])).toContain(
      `mcp__${PIPELINE_SERVER}__${SET_PIPELINE_STAGE}`
    );
  });

  it("carries the two servers the conventions and the gate were written for", () => {
    expect([...TOOL_SERVERS].sort()).toEqual([LIBRARY_SERVER, PIPELINE_SERVER]);
  });
});
