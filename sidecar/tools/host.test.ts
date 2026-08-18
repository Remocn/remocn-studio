// @vitest-environment node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { toolServer } from "./host";
import { TOOL_SPECS } from "./specs";

async function connected(ask: Parameters<typeof toolServer>[1]) {
  const server = toolServer("remocn-pipeline", ask);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  return client;
}

describe("toolServer", () => {
  it("lists exactly the tools the specs declare", async () => {
    const client = await connected(() =>
      Promise.resolve({ isError: false, text: "" })
    );

    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      TOOL_SPECS["remocn-pipeline"].map((spec) => spec.name).sort()
    );
  });

  it("forwards a call and hands back the gateway's text", async () => {
    const calls: unknown[] = [];
    const client = await connected((tool, params) => {
      calls.push([tool, params]);
      return Promise.resolve({ isError: false, text: "stage moved" });
    });

    const answer = await client.callTool({
      arguments: { stage: "analysis", status: "done" },
      name: "set_pipeline_stage",
    });

    expect(calls).toEqual([
      ["set_pipeline_stage", { stage: "analysis", status: "done" }],
    ]);
    expect(answer.content).toEqual([{ text: "stage moved", type: "text" }]);
    expect(answer.isError).toBeFalsy();
  });

  it("marks a failed answer as an error the agent can read", async () => {
    const client = await connected(() =>
      Promise.resolve({ isError: true, text: "the studio went away" })
    );

    const answer = await client.callTool({
      arguments: {},
      name: "start_video_pipeline",
    });

    expect(answer.isError).toBe(true);
    expect(answer.content).toEqual([
      { text: "the studio went away", type: "text" },
    ]);
  });
});
