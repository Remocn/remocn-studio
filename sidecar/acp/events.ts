import type { AgentEvent } from "@/shared/ipc";
import type { ToolVerb } from "@/shared/providers";

// The slices of an ACP `session/update` this translator reads. `content` is
// two different shapes on the wire: a single content block on message and
// thought chunks, an array of tool-call content on tool_call frames — which
// is why it stays unknown here and each branch reads its own shape. The
// protocol carries more kinds; anything unrecognised falls through to
// nothing rather than to a crash.
export interface AcpUpdate {
  content?: unknown;
  kind?: string;
  locations?: readonly { path?: string }[];
  rawInput?: unknown;
  sessionUpdate?: string;
  status?: string;
  title?: string;
  toolCallId?: string;
}

// ACP tool kinds translated into the neutral vocabulary the icons key on.
const VERBS: ReadonlyMap<string, ToolVerb> = new Map<string, ToolVerb>([
  ["delete", "edit"],
  ["edit", "edit"],
  ["execute", "run"],
  ["fetch", "web"],
  ["move", "edit"],
  ["read", "read"],
  ["search", "search"],
]);

const SETTLED = new Set(["completed", "failed"]);

export interface AcpTranslator {
  readonly take: (update: AcpUpdate) => AgentEvent[];
}

// One translator per turn, as stateful as the stream it reads: tool calls
// arrive as tool_call and then tool_call_update frames sharing an id, and a
// replayed history (session/load) is suppressed by feeding the translator
// nothing until the load has answered.
export function makeAcpTranslator(): AcpTranslator {
  const opened = new Set<string>();
  const settled = new Set<string>();
  const results = new Map<string, string>();

  const openTool = (id: string, update: AcpUpdate): AgentEvent[] => {
    if (opened.has(id)) {
      return [];
    }
    opened.add(id);
    return [
      {
        id,
        input: inputOf(update),
        name: update.title ?? update.kind ?? "tool",
        type: "tool_use",
        verb: VERBS.get(update.kind ?? "") ?? null,
      },
    ];
  };

  const settleTool = (id: string, update: AcpUpdate): AgentEvent[] => {
    if (!SETTLED.has(update.status ?? "") || settled.has(id)) {
      return [];
    }
    settled.add(id);
    return [
      {
        id,
        isError: update.status === "failed",
        text: results.get(id) ?? "",
        type: "tool_result",
      },
    ];
  };

  const toolEvents = (update: AcpUpdate): AgentEvent[] => {
    const id = update.toolCallId ?? "";
    if (id.length === 0) {
      return [];
    }

    const gathered = toolText(update.content);
    if (gathered.length > 0) {
      results.set(id, gathered);
    }

    return [...openTool(id, update), ...settleTool(id, update)];
  };

  const take = (update: AcpUpdate): AgentEvent[] => {
    if (update.sessionUpdate === "agent_message_chunk") {
      const text = chunkText(update.content);
      return text.length > 0 ? [{ text, type: "text" }] : [];
    }

    if (update.sessionUpdate === "agent_thought_chunk") {
      const text = chunkText(update.content);
      return text.length > 0 ? [{ text, type: "thinking" }] : [];
    }

    if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      return toolEvents(update);
    }

    return [];
  };

  return { take };
}

function chunkText(content: unknown): string {
  const block = content as { text?: string } | undefined;
  return typeof block?.text === "string" ? block.text : "";
}

function toolText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((item) => {
      const block = (item as { content?: { text?: string } }).content;
      return typeof block?.text === "string" ? [block.text] : [];
    })
    .join("\n");
}

function inputOf(update: AcpUpdate): Record<string, unknown> {
  const paths = (update.locations ?? []).flatMap((location) =>
    typeof location.path === "string" ? [location.path] : []
  );

  return {
    ...(typeof update.rawInput === "object" && update.rawInput !== null
      ? (update.rawInput as Record<string, unknown>)
      : {}),
    ...(paths.length > 0 ? { path: paths[0] } : {}),
  };
}
