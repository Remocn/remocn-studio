import type {
  SDKAssistantMessageError,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import {
  failureFromText,
  failureOf,
  NOT_AUTHENTICATED,
} from "@/sidecar/claude/failure";

function assistant(error: SDKAssistantMessageError, text: string): SDKMessage {
  return {
    error,
    message: { content: [{ text, type: "text" }] },
    parent_tool_use_id: null,
    session_id: "s",
    type: "assistant",
    uuid: "u",
  } as unknown as SDKMessage;
}

function errorResult(errors: string[]): SDKMessage {
  return {
    errors,
    is_error: true,
    session_id: "s",
    subtype: "error_during_execution",
    type: "result",
    uuid: "u",
  } as unknown as SDKMessage;
}

describe("failureFromText", () => {
  it("says plainly that Claude Code is not logged in", () => {
    expect(
      failureFromText("OAuth token has expired. Please run /login")
    ).toEqual({ kind: "auth", message: NOT_AUTHENTICATED });
  });

  it.each([
    "Invalid API key · Please run /login",
    "authentication_error: unauthorized",
    "You are not authenticated",
  ])("reads %s as an auth failure", (text) => {
    expect(failureFromText(text).kind).toBe("auth");
  });

  it("keeps a usage limit message readable and does not call it auth", () => {
    const failure = failureFromText("You've hit your usage limit · resets 4pm");

    expect(failure.kind).toBe("usage");
    expect(failure.message).toBe("You've hit your usage limit · resets 4pm");
  });

  it("reads an org policy block as a usage failure", () => {
    expect(failureFromText("This service is disabled for your org").kind).toBe(
      "usage"
    );
  });

  it("falls back to unknown, keeping the original words", () => {
    expect(failureFromText("the socket hung up")).toEqual({
      kind: "unknown",
      message: "the socket hung up",
    });
  });

  it("never returns an empty message", () => {
    expect(failureFromText("   ").message.length).toBeGreaterThan(0);
  });
});

describe("failureOf", () => {
  it("maps an authentication_failed assistant error to auth", () => {
    expect(failureOf(assistant("authentication_failed", ""))).toEqual({
      kind: "auth",
      message: NOT_AUTHENTICATED,
    });
  });

  it("maps rate_limit to usage and keeps the model's words", () => {
    expect(failureOf(assistant("rate_limit", "Slow down"))).toEqual({
      kind: "usage",
      message: "Slow down",
    });
  });

  it("maps model_not_found to model", () => {
    expect(failureOf(assistant("model_not_found", "no such model"))?.kind).toBe(
      "model"
    );
  });

  it("reads an error result", () => {
    expect(failureOf(errorResult(["  boom  "]))).toEqual({
      kind: "unknown",
      message: "boom",
    });
  });

  it("finds nothing in an ordinary assistant message", () => {
    const ordinary = {
      message: { content: [{ text: "hi", type: "text" }] },
      parent_tool_use_id: null,
      session_id: "s",
      type: "assistant",
      uuid: "u",
    } as unknown as SDKMessage;

    expect(failureOf(ordinary)).toBeNull();
  });
});
