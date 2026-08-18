import type { ThreadEvent } from "@openai/codex-sdk";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "./events";

// The first four frames are a real capture from codex-cli 0.147.0
// (`codex exec --json`), not an imagined shape.
const CAPTURED: ThreadEvent[] = [
  { thread_id: "01a015d8-370a-7681-b6cb-9e4a3612c683", type: "thread.started" },
  { type: "turn.started" },
  {
    item: {
      id: "item_0",
      message: "Skill descriptions were shortened to fit the budget.",
      type: "error",
    },
    type: "item.completed",
  },
  {
    item: { id: "item_1", text: "ok", type: "agent_message" },
    type: "item.completed",
  },
  {
    type: "turn.completed",
    usage: {
      cache_write_input_tokens: 0,
      cached_input_tokens: 9984,
      input_tokens: 17_150,
      output_tokens: 5,
      reasoning_output_tokens: 0,
    },
  },
];

describe("makeTranslator", () => {
  it("translates a real captured turn into the neutral vocabulary", () => {
    const translator = makeTranslator("auto");
    const events = CAPTURED.flatMap((event) => translator.take(event));

    expect(events).toEqual([
      {
        mode: "auto",
        model: "",
        sessionId: "01a015d8-370a-7681-b6cb-9e4a3612c683",
        type: "session",
      },
      {
        message: "Skill descriptions were shortened to fit the budget.",
        type: "notice",
      },
      { text: "ok", type: "text" },
    ]);
  });

  it("opens a command as a run and settles it with its output", () => {
    const translator = makeTranslator("auto");

    const started = translator.take({
      item: {
        aggregated_output: "",
        command: "bun install",
        id: "cmd_1",
        status: "in_progress",
        type: "command_execution",
      },
      type: "item.started",
    });
    const completed = translator.take({
      item: {
        aggregated_output: "error: lockfile drift",
        command: "bun install",
        exit_code: 1,
        id: "cmd_1",
        status: "failed",
        type: "command_execution",
      },
      type: "item.completed",
    });

    expect(started).toEqual([
      {
        id: "cmd_1",
        input: { command: "bun install" },
        name: "shell",
        type: "tool_use",
        verb: "run",
      },
    ]);
    expect(completed).toEqual([
      {
        id: "cmd_1",
        isError: true,
        text: "error: lockfile drift",
        type: "tool_result",
      },
    ]);
  });

  it("opens and settles in one step when an item only ever completes", () => {
    const translator = makeTranslator("auto");

    const events = translator.take({
      item: {
        changes: [
          { kind: "add", path: "src/Scene.tsx" },
          { kind: "add", path: "src/ease.ts" },
        ],
        id: "patch_1",
        status: "completed",
        type: "file_change",
      },
      type: "item.completed",
    });

    expect(events).toEqual([
      {
        id: "patch_1",
        input: {
          changes: [
            { kind: "add", path: "src/Scene.tsx" },
            { kind: "add", path: "src/ease.ts" },
          ],
          path: "src/Scene.tsx",
        },
        name: "apply_patch",
        type: "tool_use",
        verb: "create",
      },
      {
        id: "patch_1",
        isError: false,
        text: "add src/Scene.tsx\nadd src/ease.ts",
        type: "tool_result",
      },
    ]);
  });

  it("calls a patch that touches an existing file an edit", () => {
    const translator = makeTranslator("auto");

    const [opened] = translator.take({
      item: {
        changes: [{ kind: "update", path: "src/Root.tsx" }],
        id: "patch_2",
        status: "completed",
        type: "file_change",
      },
      type: "item.completed",
    });

    expect(opened).toMatchObject({ type: "tool_use", verb: "edit" });
  });

  it("names an MCP call the way the gate and the history already spell it", () => {
    const translator = makeTranslator("auto");

    const started = translator.take({
      item: {
        arguments: { stage: "analysis", status: "done" },
        id: "mcp_1",
        server: "remocn-pipeline",
        status: "in_progress",
        tool: "set_pipeline_stage",
        type: "mcp_tool_call",
      },
      type: "item.started",
    });
    const completed = translator.take({
      item: {
        arguments: { stage: "analysis", status: "done" },
        id: "mcp_1",
        result: {
          content: [{ text: "stage moved", type: "text" }],
          structured_content: null,
        },
        server: "remocn-pipeline",
        status: "completed",
        tool: "set_pipeline_stage",
        type: "mcp_tool_call",
      },
      type: "item.completed",
    });

    expect(started).toEqual([
      {
        id: "mcp_1",
        input: { stage: "analysis", status: "done" },
        name: "mcp__remocn-pipeline__set_pipeline_stage",
        type: "tool_use",
        verb: null,
      },
    ]);
    expect(completed).toEqual([
      { id: "mcp_1", isError: false, text: "stage moved", type: "tool_result" },
    ]);
  });

  it("survives the nulls the wire really carries where the types say optional", () => {
    const translator = makeTranslator("auto");

    const events = translator.take({
      item: {
        arguments: {},
        error: null,
        id: "mcp_2",
        result: null,
        server: "remocn-pipeline",
        status: "completed",
        tool: "start_video_pipeline",
        type: "mcp_tool_call",
      },
      type: "item.completed",
    } as unknown as ThreadEvent);

    expect(events).toEqual([
      {
        id: "mcp_2",
        input: {},
        name: "mcp__remocn-pipeline__start_video_pipeline",
        type: "tool_use",
        verb: null,
      },
      { id: "mcp_2", isError: false, text: "", type: "tool_result" },
    ]);
  });

  it("reads a wire error object as the failure it is", () => {
    const translator = makeTranslator("auto");

    const [, result] = translator.take({
      item: {
        arguments: {},
        error: { message: "user cancelled MCP tool call" },
        id: "mcp_3",
        server: "remocn-pipeline",
        status: "failed",
        tool: "start_video_pipeline",
        type: "mcp_tool_call",
      },
      type: "item.completed",
    });

    expect(result).toEqual({
      id: "mcp_3",
      isError: true,
      text: "user cancelled MCP tool call",
      type: "tool_result",
    });
  });

  it("streams a growing message as deltas, never repeating what it said", () => {
    const translator = makeTranslator("auto");

    const first = translator.take({
      item: { id: "msg_1", text: "Building", type: "agent_message" },
      type: "item.updated",
    });
    const second = translator.take({
      item: { id: "msg_1", text: "Building the scene.", type: "agent_message" },
      type: "item.completed",
    });
    const again = translator.take({
      item: { id: "msg_1", text: "Building the scene.", type: "agent_message" },
      type: "item.completed",
    });

    expect(first).toEqual([{ text: "Building", type: "text" }]);
    expect(second).toEqual([{ text: " the scene.", type: "text" }]);
    expect(again).toEqual([]);
  });

  it("reads reasoning as thinking", () => {
    const translator = makeTranslator("auto");

    const events = translator.take({
      item: { id: "r_1", text: "The title needs easing.", type: "reasoning" },
      type: "item.completed",
    });

    expect(events).toEqual([
      { text: "The title needs easing.", type: "thinking" },
    ]);
  });

  it("keeps the todo list and turn bookkeeping off the stream", () => {
    const translator = makeTranslator("auto");

    expect(
      translator.take({
        item: {
          id: "todo_1",
          items: [{ completed: false, text: "Write the scene" }],
          type: "todo_list",
        },
        type: "item.completed",
      })
    ).toEqual([]);
    expect(translator.take({ type: "turn.started" })).toEqual([]);
    expect(
      translator.take({ error: { message: "boom" }, type: "turn.failed" })
    ).toEqual([]);
  });
});
