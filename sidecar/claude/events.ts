import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ClaudeEvent } from "@/shared/ipc";

export function eventsOf(message: SDKMessage): ClaudeEvent[] {
  if (message.type === "system") {
    return message.subtype === "init"
      ? [
          {
            model: message.model,
            sessionId: message.session_id,
            type: "session",
          },
        ]
      : [];
  }

  if (message.type === "stream_event") {
    return deltaEvents(message.event);
  }

  if (message.type === "assistant") {
    return toolUses(message.message.content);
  }

  if (message.type === "user") {
    return toolResults(message.message.content);
  }

  return [];
}

function deltaEvents(event: { delta?: unknown; type: string }): ClaudeEvent[] {
  if (event.type !== "content_block_delta") {
    return [];
  }

  const delta = event.delta as
    | { text?: string; thinking?: string; type?: string }
    | undefined;

  if (delta?.type === "text_delta" && typeof delta.text === "string") {
    return [{ text: delta.text, type: "text" }];
  }
  if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
    return [{ text: delta.thinking, type: "thinking" }];
  }
  return [];
}

function toolUses(content: unknown): ClaudeEvent[] {
  return blocks(content).flatMap((block) =>
    block.type === "tool_use" &&
    typeof block.id === "string" &&
    typeof block.name === "string"
      ? [
          {
            id: block.id,
            input: block.input,
            name: block.name,
            type: "tool_use",
          },
        ]
      : []
  );
}

function toolResults(content: unknown): ClaudeEvent[] {
  return blocks(content).flatMap((block) =>
    block.type === "tool_result" && typeof block.tool_use_id === "string"
      ? [
          {
            id: block.tool_use_id,
            isError: block.is_error === true,
            text: flatten(block.content),
            type: "tool_result",
          },
        ]
      : []
  );
}

interface Block {
  content?: unknown;
  id?: unknown;
  input?: unknown;
  is_error?: unknown;
  name?: unknown;
  text?: unknown;
  tool_use_id?: unknown;
  type?: unknown;
}

function blocks(content: unknown): Block[] {
  return Array.isArray(content) ? (content as Block[]) : [];
}

export function flatten(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return blocks(content)
    .flatMap((block) => (typeof block.text === "string" ? [block.text] : []))
    .join("\n");
}
