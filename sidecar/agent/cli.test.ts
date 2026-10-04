import { describe, expect, it } from "bun:test";
import { missingRow as claudeMissing } from "../claude/account";
import { missingRow as codexMissing } from "../codex/account";
import { missingRow as copilotMissing } from "../copilot/account";
import { missingRow as grokMissing } from "../grok/account";
import { missingCli } from "./cli";

const ROWS = [claudeMissing(), codexMissing(), copilotMissing(), grokMissing()];

describe("missingCli", () => {
  it("fails a turn the same way on every provider, in its own words", () => {
    const results = ROWS.map((row) => missingCli(row, { sessionId: "kept" }));

    expect(new Set(results.map((result) => result.failure?.kind))).toEqual(
      new Set(["auth"])
    );
    expect(results.map((result) => result.failure?.message)).toEqual(
      ROWS.map((row) => row.detail)
    );
    expect(new Set(results.map((result) => result.failure?.message)).size).toBe(
      ROWS.length
    );
    for (const result of results) {
      expect(result.context).toBeNull();
      expect(result.sessionId).toBe("kept");
    }
  });

  it("falls back to the row's title when it carries no detail", () => {
    const result = missingCli(
      { ...claudeMissing(), detail: null },
      { sessionId: null }
    );

    expect(result.failure).toEqual({
      kind: "auth",
      message: "Claude Code is not installed",
    });
    expect(result.sessionId).toBeNull();
  });
});
