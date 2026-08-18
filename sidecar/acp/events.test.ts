import { describe, expect, it } from "vitest";
import { makeAcpTranslator } from "./events";

describe("makeAcpTranslator", () => {
  it("reads message and thought chunks as text and thinking", () => {
    const translator = makeAcpTranslator();

    expect(
      translator.take({
        content: { text: "Building the scene.", type: "text" },
        sessionUpdate: "agent_message_chunk",
      })
    ).toEqual([{ text: "Building the scene.", type: "text" }]);

    expect(
      translator.take({
        content: { text: "The title needs easing.", type: "text" },
        sessionUpdate: "agent_thought_chunk",
      })
    ).toEqual([{ text: "The title needs easing.", type: "thinking" }]);
  });

  it("opens a tool call once and settles it with its gathered output", () => {
    const translator = makeAcpTranslator();

    const started = translator.take({
      kind: "execute",
      rawInput: { command: "bun install" },
      sessionUpdate: "tool_call",
      status: "pending",
      title: "Run bun install",
      toolCallId: "call_1",
    });
    const progressed = translator.take({
      sessionUpdate: "tool_call_update",
      status: "in_progress",
      toolCallId: "call_1",
    });
    const completed = translator.take({
      content: [
        {
          content: { text: "47 packages installed", type: "text" },
          type: "content",
        },
      ],
      sessionUpdate: "tool_call_update",
      status: "completed",
      toolCallId: "call_1",
    });

    expect(started).toEqual([
      {
        id: "call_1",
        input: { command: "bun install" },
        name: "Run bun install",
        type: "tool_use",
        verb: "run",
      },
    ]);
    expect(progressed).toEqual([]);
    expect(completed).toEqual([
      {
        id: "call_1",
        isError: false,
        text: "47 packages installed",
        type: "tool_result",
      },
    ]);
  });

  it("opens and settles in one frame when the call arrives already failed", () => {
    const translator = makeAcpTranslator();

    const events = translator.take({
      kind: "edit",
      locations: [{ path: "/videos/promo/src/Main.tsx" }],
      sessionUpdate: "tool_call",
      status: "failed",
      title: "Edit Main.tsx",
      toolCallId: "call_2",
    });

    expect(events).toEqual([
      {
        id: "call_2",
        input: { path: "/videos/promo/src/Main.tsx" },
        name: "Edit Main.tsx",
        type: "tool_use",
        verb: "edit",
      },
      { id: "call_2", isError: true, text: "", type: "tool_result" },
    ]);
  });

  it("never settles the same call twice", () => {
    const translator = makeAcpTranslator();

    translator.take({
      kind: "read",
      sessionUpdate: "tool_call",
      status: "completed",
      toolCallId: "call_3",
    });
    const again = translator.take({
      sessionUpdate: "tool_call_update",
      status: "completed",
      toolCallId: "call_3",
    });

    expect(again).toEqual([]);
  });

  it("lets an update kind it does not know fall through to nothing", () => {
    const translator = makeAcpTranslator();

    expect(
      translator.take({ sessionUpdate: "available_commands_update" })
    ).toEqual([]);
    expect(translator.take({ sessionUpdate: "plan" })).toEqual([]);
    expect(translator.take({})).toEqual([]);
  });
});
