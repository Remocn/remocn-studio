import type { ThreadEvent, ThreadItem } from "@openai/codex-sdk";
import type { AgentEvent, SessionMode } from "@/shared/ipc";

// Codex speaks in items that start, update and complete, not in deltas — so
// the translator keeps a little memory: how much of each text item it has
// already emitted, and which tool items it has opened and settled. One
// translator per turn, exactly as stateful as the stream it reads.
export interface Translator {
  readonly take: (event: ThreadEvent) => AgentEvent[];
}

export function makeTranslator(requested: SessionMode): Translator {
  const emittedText = new Map<string, number>();
  const openedTools = new Set<string>();
  const settledTools = new Set<string>();

  const take = (event: ThreadEvent): AgentEvent[] => {
    if (event.type === "thread.started") {
      return [
        {
          mode: requested,
          model: "",
          sessionId: event.thread_id,
          type: "session",
        },
      ];
    }

    if (
      event.type === "item.started" ||
      event.type === "item.updated" ||
      event.type === "item.completed"
    ) {
      return itemEvents(event.item, event.type === "item.completed");
    }

    return [];
  };

  const itemEvents = (item: ThreadItem, completed: boolean): AgentEvent[] => {
    if (item.type === "agent_message") {
      return textEvents(item.id, item.text, "text");
    }
    if (item.type === "reasoning") {
      return textEvents(item.id, item.text, "thinking");
    }
    if (item.type === "error") {
      return completed ? [{ message: item.message, type: "notice" }] : [];
    }
    if (item.type === "todo_list") {
      return [];
    }

    const events: AgentEvent[] = [];

    if (!openedTools.has(item.id)) {
      openedTools.add(item.id);
      events.push(opened(item));
    }
    if (completed && !settledTools.has(item.id)) {
      settledTools.add(item.id);
      events.push(settled(item));
    }

    return events;
  };

  const textEvents = (
    id: string,
    text: string,
    type: "text" | "thinking"
  ): AgentEvent[] => {
    const already = emittedText.get(id) ?? 0;
    if (text.length <= already) {
      return [];
    }

    emittedText.set(id, text.length);
    return [{ text: text.slice(already), type }];
  };

  return { take };
}

type ToolItem = Exclude<
  ThreadItem,
  | { type: "agent_message" }
  | { type: "reasoning" }
  | { type: "error" }
  | { type: "todo_list" }
>;

function opened(item: ToolItem): AgentEvent {
  if (item.type === "command_execution") {
    return {
      id: item.id,
      input: { command: item.command },
      name: "shell",
      type: "tool_use",
      verb: "run",
    };
  }

  if (item.type === "file_change") {
    const paths = item.changes.map((change) => change.path);
    return {
      id: item.id,
      input: { changes: item.changes, path: paths[0] ?? "" },
      name: "apply_patch",
      type: "tool_use",
      verb: item.changes.every((change) => change.kind === "add")
        ? "create"
        : "edit",
    };
  }

  if (item.type === "web_search") {
    return {
      id: item.id,
      input: { query: item.query },
      name: "web_search",
      type: "tool_use",
      verb: "web",
    };
  }

  return {
    id: item.id,
    input: item.arguments,
    name: `mcp__${item.server}__${item.tool}`,
    type: "tool_use",
    verb: null,
  };
}

function settled(item: ToolItem): AgentEvent {
  if (item.type === "command_execution") {
    return {
      id: item.id,
      isError:
        item.status === "failed" ||
        (typeof item.exit_code === "number" && item.exit_code !== 0),
      text: item.aggregated_output,
      type: "tool_result",
    };
  }

  if (item.type === "file_change") {
    return {
      id: item.id,
      isError: item.status === "failed",
      text: item.changes
        .map((change) => `${change.kind} ${change.path}`)
        .join("\n"),
      type: "tool_result",
    };
  }

  if (item.type === "web_search") {
    return { id: item.id, isError: false, text: "", type: "tool_result" };
  }

  return {
    id: item.id,
    isError: item.status === "failed" || (item.error ?? null) !== null,
    text: mcpText(item),
    type: "tool_result",
  };
}

// The SDK types say `error?:` and `result?:`, but the wire carries explicit
// nulls — measured against codex-cli 0.147.0, where trusting the types cost
// a crash mid-turn.
function mcpText(item: Extract<ToolItem, { type: "mcp_tool_call" }>): string {
  const error = item.error ?? null;
  if (error !== null) {
    return error.message;
  }

  const blocks = item.result?.content ?? [];
  return blocks
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
}
