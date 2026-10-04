import { describe, expect, it, spyOn } from "bun:test";
import { Effect } from "effect";
import { AGENT_PROVIDERS, PROVIDER_INFO } from "@/shared/providers";
import { acpPool } from "../acp/pool";
import { adapterFor, forgetChat } from "./registry";

describe("adapterFor", () => {
  it("answers every provider the contract declares", () => {
    for (const provider of AGENT_PROVIDERS) {
      const adapter = adapterFor(provider);
      expect(adapter.info.id).toBe(provider);
      expect(adapter.info).toEqual(PROVIDER_INFO[provider]);
    }
  });

  it("keeps Claude the non-experimental adapter with every capability", () => {
    const claude = adapterFor("claude");

    expect(claude.info.experimental).toBe(false);
    expect(claude.info.capabilities).toEqual({
      context: true,
      effort: true,
      modes: true,
      planTool: true,
      resume: true,
      thinking: true,
    });
  });

  it("names the plan tool each runtime exposes, and none it could not verify", () => {
    expect(
      Object.fromEntries(
        AGENT_PROVIDERS.map((provider) => [
          provider,
          adapterFor(provider).info.planningTool,
        ])
      )
    ).toEqual({
      claude: "TaskCreate",
      codex: "update_plan",
      copilot: null,
      grok: "todo_write",
    });
  });

  it("keys the tools by the chat on the ACP adapters and by the turn elsewhere", () => {
    const ids = { chat: "chat-row", turn: "turn-1" };

    expect(
      Object.fromEntries(
        AGENT_PROVIDERS.map((provider) => [
          provider,
          adapterFor(provider).toolKey(ids),
        ])
      )
    ).toEqual({
      claude: "turn-1",
      codex: "turn-1",
      copilot: "chat-chat-row",
      grok: "chat-chat-row",
    });
  });
});

describe("forgetChat", () => {
  it("disposes the chat's held ACP process", async () => {
    const dispose = spyOn(acpPool, "dispose");

    try {
      await Effect.runPromise(forgetChat("deleted-chat"));

      expect(dispose).toHaveBeenCalled();
      expect(new Set(dispose.mock.calls.map(([chat]) => chat))).toEqual(
        new Set(["deleted-chat"])
      );
    } finally {
      dispose.mockRestore();
    }
  });

  it("is harmless for a chat no adapter holds", async () => {
    const before = acpPool.size();

    await Effect.runPromise(forgetChat("never-held"));

    expect(acpPool.size()).toBe(before);
  });
});
