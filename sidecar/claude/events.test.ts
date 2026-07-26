import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import type { SessionMode } from "@/shared/ipc";
import { eventsOf } from "@/sidecar/claude/events";

const MODE: SessionMode = "auto";

function message(shape: Record<string, unknown>): SDKMessage {
  return { session_id: "s", uuid: "u", ...shape } as unknown as SDKMessage;
}

function init(permissionMode: string): SDKMessage {
  return message({
    model: "claude-opus-5",
    permissionMode,
    session_id: "abc",
    subtype: "init",
    type: "system",
  });
}

describe("eventsOf", () => {
  it("turns the init frame into a session event carrying the mode", () => {
    expect(eventsOf(init("auto"), MODE)).toEqual([
      {
        mode: "auto",
        model: "claude-opus-5",
        sessionId: "abc",
        type: "session",
      },
    ]);
  });

  it("says so when the turn did not run in the mode it asked for", () => {
    expect(eventsOf(init("default"), MODE)).toEqual([
      {
        mode: null,
        model: "claude-opus-5",
        sessionId: "abc",
        type: "session",
      },
      {
        message: "Claude Code ran this turn in default mode, not Auto.",
        type: "notice",
      },
    ]);
  });

  it("reports a call declined without a card", () => {
    expect(
      eventsOf(
        message({
          decision_reason: "writes outside the workspace are not allowed",
          decision_reason_type: "classifier",
          message: "denied",
          subtype: "permission_denied",
          tool_name: "Write",
          tool_use_id: "t1",
          type: "system",
        }),
        MODE
      )
    ).toEqual([
      {
        message:
          "Claude Code declined Write without asking. writes outside the workspace are not allowed",
        type: "notice",
      },
    ]);
  });

  it("ignores other system frames", () => {
    expect(
      eventsOf(message({ subtype: "status", type: "system" }), MODE)
    ).toEqual([]);
  });

  it("forwards a text delta", () => {
    expect(
      eventsOf(
        message({
          event: {
            delta: { text: "Hel", type: "text_delta" },
            type: "content_block_delta",
          },
          type: "stream_event",
        }),
        MODE
      )
    ).toEqual([{ text: "Hel", type: "text" }]);
  });

  it("forwards a thinking delta separately from text", () => {
    expect(
      eventsOf(
        message({
          event: {
            delta: { thinking: "hmm", type: "thinking_delta" },
            type: "content_block_delta",
          },
          type: "stream_event",
        }),
        MODE
      )
    ).toEqual([{ text: "hmm", type: "thinking" }]);
  });

  it("ignores stream events that carry no content", () => {
    expect(
      eventsOf(
        message({ event: { type: "message_start" }, type: "stream_event" }),
        MODE
      )
    ).toEqual([]);
  });

  it("reports a tool call with its input", () => {
    expect(
      eventsOf(
        message({
          message: {
            content: [
              {
                id: "t1",
                input: { file_path: "/a.tsx" },
                name: "Edit",
                type: "tool_use",
              },
            ],
          },
          type: "assistant",
        }),
        MODE
      )
    ).toEqual([
      {
        id: "t1",
        input: { file_path: "/a.tsx" },
        name: "Edit",
        type: "tool_use",
      },
    ]);
  });

  it("reports a tool result and flattens its content", () => {
    expect(
      eventsOf(
        message({
          message: {
            content: [
              {
                content: [{ text: "done", type: "text" }],
                tool_use_id: "t1",
                type: "tool_result",
              },
            ],
          },
          type: "user",
        }),
        MODE
      )
    ).toEqual([
      { id: "t1", isError: false, text: "done", type: "tool_result" },
    ]);
  });

  it("marks a failed tool result", () => {
    expect(
      eventsOf(
        message({
          message: {
            content: [
              {
                content: "no such file",
                is_error: true,
                tool_use_id: "t2",
                type: "tool_result",
              },
            ],
          },
          type: "user",
        }),
        MODE
      )
    ).toEqual([
      { id: "t2", isError: true, text: "no such file", type: "tool_result" },
    ]);
  });
});
