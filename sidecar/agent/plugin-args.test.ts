// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PromptParams } from "@/shared/ipc";
import { type KnowledgeBundle, noBundle } from "@/sidecar/agent/knowledge";
import { copilotArgs } from "@/sidecar/copilot/adapter";
import { grokArgs } from "@/sidecar/grok/adapter";

const PLUGIN = join(process.cwd(), "agent");

const attached: KnowledgeBundle = {
  collisions: [],
  loaded: true,
  path: PLUGIN,
  reason: null,
  source: "plugin-dir",
};

const params: PromptParams = {
  assets: [],
  attachments: [],
  effort: "medium",
  elements: [],
  historyId: "session-1",
  media: [],
  mode: "auto",
  model: null,
  playing: null,
  projectId: "project-1",
  prompt: "make me a video",
  provider: "copilot",
  sessionId: null,
};

const pairs = [
  ["copilot", copilotArgs],
  ["grok", grokArgs],
] as const;

describe.each(pairs)("%s process args", (name, build) => {
  it("names the shipped bundle as the plugin directory", () => {
    const args = build(params, attached);
    const at = args.indexOf("--plugin-dir");

    expect(at).toBeGreaterThanOrEqual(0);
    expect(args[at + 1]).toBe(PLUGIN);
  });

  it("passes no plugin directory when there is no bundle", () => {
    expect(build(params, noBundle("nothing shipped"))).not.toContain(
      "--plugin-dir"
    );
  });

  it("names a directory the app ships, never the project", () => {
    const args = build(params, attached);

    expect(args[args.indexOf("--plugin-dir") + 1]).not.toContain(
      params.projectId
    );
    expect(name).toBeTypeOf("string");
  });
});

describe("grok process args", () => {
  it("keeps --plugin-dir in front of the stdio subcommand", () => {
    const args = grokArgs(params, attached);

    expect(args.indexOf("--plugin-dir")).toBeLessThan(args.indexOf("stdio"));
  });
});
