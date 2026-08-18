import { describe, expect, it } from "vitest";
import { accountRow, unreachableRow } from "./account";

describe("accountRow", () => {
  it("reads a logged-out CLI off tokenSource, which is the only signal it sends", () => {
    const check = accountRow({
      apiProvider: "firstParty",
      tokenSource: "none",
    });

    expect(check.state).toBe("failed");
    expect(check.fix).toEqual({ command: "claude", type: "command" });
  });

  it("passes a logged-in account and shows the subscription", () => {
    const check = accountRow({
      apiProvider: "firstParty",
      email: "someone@example.com",
      subscriptionType: "Claude Max",
    });

    expect(check.state).toBe("ok");
    expect(check.detail).toBe("Claude Max");
  });

  it("treats a third-party provider as authenticated elsewhere", () => {
    const check = accountRow({ apiProvider: "bedrock" });

    expect(check.state).toBe("ok");
    expect(check.detail).toContain("bedrock");
  });

  it("keeps a CLI that would not start distinct from one that is logged out", () => {
    const check = unreachableRow("spawn failed");

    expect(check.state).toBe("failed");
    expect(check.title).not.toBe(accountRow({ tokenSource: "none" }).title);
  });
});
