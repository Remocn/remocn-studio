import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { eventsOf } from "@/sidecar/claude/events";

function message(shape: Record<string, unknown>): SDKMessage {
  return { session_id: "s", uuid: "u", ...shape } as unknown as SDKMessage;
}

describe("eventsOf", () => {
  it("turns the init frame into a session event", () => {
    expect(
      eventsOf(
        message({
          model: "claude-opus-5",
          session_id: "abc",
          subtype: "init",
          type: "system",
        })
      )
    ).toEqual([{ model: "claude-opus-5", sessionId: "abc", type: "session" }]);
  });

  it("ignores other system frames", () => {
    expect(eventsOf(message({ subtype: "status", type: "system" }))).toEqual(
      []
    );
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
        })
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
        })
      )
    ).toEqual([{ text: "hmm", type: "thinking" }]);
  });

  it("ignores stream events that carry no content", () => {
    expect(
      eventsOf(
        message({ event: { type: "message_start" }, type: "stream_event" })
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
        })
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
        })
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
        })
      )
    ).toEqual([
      { id: "t2", isError: true, text: "no such file", type: "tool_result" },
    ]);
  });
});
