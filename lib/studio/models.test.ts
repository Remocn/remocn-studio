import { describe, expect, it } from "bun:test";
import {
  CLAUDE_MODELS,
  modeChoices,
  modelLabelOf,
  offersAutoMode,
  runningMode,
  runningModeLabel,
} from "@/lib/studio/models";

// Measured one probe per model against the real CLI, reading the mode
// `system`/`init` answers with: everything in the catalog runs Auto except
// Haiku 4.5, which Claude Code silently downgrades to `default`.
describe("offersAutoMode", () => {
  it("knows the one Claude model that cannot run Auto", () => {
    const without = CLAUDE_MODELS.filter(
      (model) => !offersAutoMode(model.value)
    );

    expect(without.map((model) => model.label)).toEqual(["Haiku 4.5"]);
  });

  it("treats a model it has never heard of as offering Auto", () => {
    expect(offersAutoMode("claude-something-6")).toBe(true);
  });
});

describe("runningMode", () => {
  it("falls Auto back to what the turn will really run in", () => {
    expect(runningMode("auto", "claude-haiku-4-5-20251001")).toBe("default");
    expect(
      runningModeLabel(runningMode("auto", "claude-haiku-4-5-20251001"))
    ).toBe("Default");
  });

  it("leaves Auto alone on a model that has it", () => {
    expect(runningMode("auto", "claude-opus-5")).toBe("auto");
    expect(runningModeLabel(runningMode("auto", "claude-opus-5"))).toBe("Auto");
  });

  // Only Auto is downgraded — the other two run on every model, so a fallback
  // there would be inventing a limit that is not measured.
  it("leaves the other modes alone on a model without Auto", () => {
    expect(runningMode("acceptEdits", "claude-haiku-4-5-20251001")).toBe(
      "acceptEdits"
    );
    expect(runningMode("plan", "claude-haiku-4-5-20251001")).toBe("plan");
  });
});

describe("modelLabelOf", () => {
  it("names a model the catalog knows", () => {
    expect(modelLabelOf("claude", "claude-haiku-4-5-20251001")).toBe(
      "Haiku 4.5"
    );
  });
});

describe("modeChoices", () => {
  const HAIKU = "claude-haiku-4-5-20251001";

  it("disables Auto on a Claude model that cannot run it, and says so", () => {
    const choices = modeChoices("claude", "auto", HAIKU);

    expect(choices.running).toBe("default");
    expect(choices.hint).toBe("Haiku 4.5 does not offer Auto");
    expect(choices.items).toEqual([
      {
        disabled: true,
        hint: "Haiku 4.5 does not offer this mode",
        label: "Auto",
        value: "auto",
      },
      { label: "Accept edits", value: "acceptEdits" },
      { label: "Plan", value: "plan" },
    ]);
  });

  it("runs the other modes as picked on that model, with no hint", () => {
    const choices = modeChoices("claude", "plan", HAIKU);

    expect(choices.running).toBe("plan");
    expect(choices.hint).toBeNull();
    expect(choices.items.find((item) => item.value === "auto")?.disabled).toBe(
      true
    );
  });

  it("offers all three modes on a Claude model that has Auto", () => {
    const choices = modeChoices("claude", "auto", "claude-opus-5");

    expect(choices.running).toBe("auto");
    expect(choices.hint).toBeNull();
    expect(choices.items.map((item) => item.value)).toEqual([
      "auto",
      "acceptEdits",
      "plan",
    ]);
    expect(choices.items.some((item) => item.disabled === true)).toBe(false);
  });

  it("offers every mode on the other providers and runs the one picked", () => {
    for (const provider of ["codex", "copilot", "grok"] as const) {
      for (const model of ["", HAIKU]) {
        const choices = modeChoices(provider, "auto", model);

        expect(choices.running).toBe("auto");
        expect(choices.hint).toBeNull();
        expect(choices.items.some((item) => item.disabled === true)).toBe(
          false
        );
      }
    }
  });
});
