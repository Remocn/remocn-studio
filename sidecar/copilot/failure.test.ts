// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  failureFromText,
  inBandFailure,
  NOT_AUTHENTICATED,
  POLICY_BLOCKED,
} from "./failure";

describe("inBandFailure", () => {
  it("reads the policy block a turn speaks as ordinary text", () => {
    const failure = inBandFailure(
      "Error: You are not authorized to use this Copilot feature, it requires an enterprise or organization policy to be enabled."
    );

    expect(failure).toEqual({ kind: "auth", message: POLICY_BLOCKED });
  });

  it("reads a logged-out turn the same way", () => {
    expect(
      inBandFailure("Error: You are not logged in. Run copilot login.")
    ).toEqual({ kind: "auth", message: NOT_AUTHENTICATED });
  });

  it("never eats an answer that merely mentions an error", () => {
    expect(
      inBandFailure(
        "The build failed with Error: module not found — fixing it."
      )
    ).toBeNull();
    expect(inBandFailure("ok")).toBeNull();
  });
});

describe("failureFromText", () => {
  it("classifies the policy block as auth with its own sentence", () => {
    const failure = failureFromText(
      "You are not authorized to use this Copilot feature"
    );

    expect(failure.kind).toBe("auth");
    expect(failure.message).toBe(POLICY_BLOCKED);
  });

  it("keeps a usage limit's own words", () => {
    expect(failureFromText("Monthly credit limit reached")).toEqual({
      kind: "usage",
      message: "Monthly credit limit reached",
    });
  });

  it("never answers with an empty sentence", () => {
    expect(failureFromText("  ").message.length).toBeGreaterThan(0);
  });
});
