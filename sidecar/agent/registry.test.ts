import { describe, expect, it } from "vitest";
import { AGENT_PROVIDERS, PROVIDER_INFO } from "@/shared/providers";
import { adapterFor } from "./registry";

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
});
