import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import type { ContextUsage, PromptParams } from "@/shared/ipc";
import { noBundle } from "../agent/knowledge";
import type { StdioTransport } from "../tools/gateway";
import {
  contextReading,
  optionsOf,
  serversOf,
  type TurnCallbacks,
} from "./session";

const stdio = (server: string): StdioTransport => ({
  args: ["main.js", "--tools-host", server],
  command: "bun",
  env: { REMOCN_STUDIO_TOOLS_TURN: "turn-1" },
});

const ask = () => Promise.resolve({ isError: false, text: "ok" });

describe("serversOf", () => {
  it("serves the studio's tools inside the sidecar, under their own server names", () => {
    const servers = serversOf({
      inProcess: { "remocn-design": ask, "remocn-library": ask },
      tools: {
        "remocn-design": stdio("remocn-design"),
        "remocn-library": stdio("remocn-library"),
      },
    });

    expect(Object.keys(servers).sort()).toEqual([
      "remocn-design",
      "remocn-library",
    ]);
    expect(servers["remocn-design"]?.type).toBe("sdk");
    expect(servers["remocn-library"]?.type).toBe("sdk");
  });

  it("spawns the tool host only for a server with no in-process link", () => {
    const servers = serversOf({
      inProcess: {},
      tools: { "remocn-pipeline": stdio("remocn-pipeline") },
    });

    expect(servers["remocn-pipeline"]).toEqual({
      args: ["main.js", "--tools-host", "remocn-pipeline"],
      command: "bun",
      env: { REMOCN_STUDIO_TOOLS_TURN: "turn-1" },
      type: "stdio",
    });
  });

  it("offers no server the turn was not given", () => {
    const servers = serversOf({
      inProcess: { "remocn-pipeline": ask },
      tools: {},
    });

    expect(servers).toEqual({});
  });
});

const PARAMS: PromptParams = {
  assets: [],
  attachments: [],
  effort: null,
  elements: [],
  historyId: "history-1",
  media: [],
  mode: "auto",
  model: null,
  playing: null,
  projectId: "project-1",
  prompt: "Make the title bigger",
  provider: "claude",
  sessionId: "resumed-session",
  videoId: "video-1",
};

const CALLBACKS: TurnCallbacks = {
  canUseTool: () => Promise.resolve({ behavior: "allow" }),
  cwd: "/projects/promo",
  executable: "/usr/local/bin/claude",
  inProcess: {},
  knowledge: noBundle("none in this test"),
  log: () => undefined,
  media: null,
  onContext: () => undefined,
  onMode: () => undefined,
  onStop: () => undefined,
  system: "THE STUDIO'S CONVENTIONS",
  tools: {},
  trailer: "THE STAGE BRIEF",
};

describe("optionsOf", () => {
  it("records the system prompt once for the chat, carrying the conventions alone", () => {
    const { systemPrompt } = optionsOf(PARAMS, CALLBACKS);

    expect(systemPrompt).toEqual({
      append: "THE STUDIO'S CONVENTIONS",
      preset: "claude_code",
      snapshot: true,
      type: "preset",
    });
    expect(JSON.stringify(systemPrompt)).not.toContain("THE STAGE BRIEF");
  });

  it("resumes the chat's provider session", () => {
    expect(optionsOf(PARAMS, CALLBACKS).resume).toBe("resumed-session");
  });
});

describe("contextReading", () => {
  const usage = { maxTokens: 200_000, totalTokens: 41_000 };

  it("asks for the summary reading and hands the meter its totals", async () => {
    const asked: unknown[] = [];
    const read: ContextUsage[] = [];

    await Effect.runPromise(
      contextReading(
        {
          getContextUsage: (options) => {
            asked.push(options);
            return Promise.resolve(usage as never);
          },
        },
        (reading) => read.push(reading)
      )
    );

    expect(asked).toEqual([{ detail: "summary" }]);
    expect(read).toEqual([usage]);
  });

  it("gives up on a reading that does not answer in its window, and reports nothing", async () => {
    const read: ContextUsage[] = [];

    await Effect.runPromise(
      contextReading(
        { getContextUsage: () => new Promise(() => undefined) },
        (reading) => read.push(reading),
        "20 millis"
      )
    );

    expect(read).toEqual([]);
  });

  it("gives up on a reading that fails, and reports nothing", async () => {
    const read: ContextUsage[] = [];

    await Effect.runPromise(
      contextReading(
        { getContextUsage: () => Promise.reject(new Error("closed")) },
        (reading) => read.push(reading)
      )
    );

    expect(read).toEqual([]);
  });
});
