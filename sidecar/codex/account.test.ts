import { describe, expect, it } from "vitest";
import { accountRow, missingRow, NOT_AUTHENTICATED } from "./account";
import { EFFORTS, SANDBOXES } from "./adapter";
import { failureFromText } from "./failure";

describe("accountRow", () => {
  it("reads a logged-in CLI off exit code zero and shows what it said", () => {
    const check = accountRow(0, "Logged in using ChatGPT\n");

    expect(check.state).toBe("ok");
    expect(check.id).toBe("codex");
    expect(check.detail).toBe("Logged in using ChatGPT");
  });

  it("turns `Not logged in` into the row that locks the composer", () => {
    const check = accountRow(1, "Not logged in\n");

    expect(check.state).toBe("failed");
    expect(check.detail).toBe(NOT_AUTHENTICATED);
    expect(check.fix).toEqual({ command: "codex login", type: "command" });
  });

  it("keeps a CLI that answered garbage distinct from one that is logged out", () => {
    const check = accountRow(2, "segfault");

    expect(check.state).toBe("failed");
    expect(check.title).not.toBe(accountRow(1, "Not logged in").title);
  });

  it("says how to install when the command is not on the machine at all", () => {
    const check = missingRow();

    expect(check.state).toBe("failed");
    expect(check.detail).toContain("npm install -g @openai/codex");
  });
});

describe("failureFromText", () => {
  it("classifies a login failure and speaks the fix", () => {
    const failure = failureFromText("stream error: 401 Unauthorized");

    expect(failure.kind).toBe("auth");
    expect(failure.message).toBe(NOT_AUTHENTICATED);
  });

  it("classifies a usage limit without rewriting its words", () => {
    const failure = failureFromText("Rate limit reached for gpt-5.1");

    expect(failure).toEqual({
      kind: "usage",
      message: "Rate limit reached for gpt-5.1",
    });
  });

  it("never answers with an empty sentence", () => {
    expect(failureFromText("  ").message.length).toBeGreaterThan(0);
  });
});

describe("mode and effort mappings", () => {
  it("keeps plan read-only, which is what plan means", () => {
    expect(SANDBOXES.plan).toBe("read-only");
    expect(SANDBOXES.auto).toBe("workspace-write");
    expect(SANDBOXES.acceptEdits).toBe("workspace-write");
  });

  it("maps every studio effort onto one Codex reasoning effort", () => {
    expect(EFFORTS).toEqual({
      high: "high",
      low: "low",
      max: "xhigh",
      medium: "medium",
      xhigh: "xhigh",
    });
  });
});
