import type {
  AgentEvent,
  PromptAttachment,
  PromptElement,
  PromptMedia,
  TranscriptEntry,
} from "./ipc";
import type { PromptAsset } from "./library";

export function appendUser(
  entries: readonly TranscriptEntry[],
  input: {
    assets: readonly PromptAsset[];
    attachments: readonly PromptAttachment[];
    elements: readonly PromptElement[];
    media: readonly PromptMedia[];
    text: string;
  }
): readonly TranscriptEntry[] {
  return [
    ...entries,
    {
      assets: input.assets,
      attachments: input.attachments,
      elements: input.elements,
      id: `user-${entries.length}`,
      kind: "user",
      media: input.media,
      text: input.text,
    },
  ];
}

export function fold(
  entries: readonly TranscriptEntry[],
  event: AgentEvent
): readonly TranscriptEntry[] {
  if (event.type === "text") {
    return appendText(entries, event.text);
  }

  if (event.type === "tool_use") {
    return [
      ...entries,
      {
        id: event.id,
        input: event.input,
        kind: "activity",
        name: event.name,
        result: null,
        state: "running",
        verb: event.verb,
      },
    ];
  }

  if (event.type === "tool_result") {
    return entries.map((entry) =>
      entry.kind === "activity" && entry.id === event.id
        ? {
            ...entry,
            result: event.text,
            state: event.isError ? "failed" : "done",
          }
        : entry
    );
  }

  if (event.type === "notice") {
    return [
      ...entries,
      { id: `notice-${entries.length}`, kind: "notice", text: event.message },
    ];
  }

  return entries;
}

function appendText(
  entries: readonly TranscriptEntry[],
  text: string
): readonly TranscriptEntry[] {
  const last = entries.at(-1);

  if (last?.kind === "assistant") {
    return [...entries.slice(0, -1), { ...last, text: last.text + text }];
  }

  return [
    ...entries,
    { id: `assistant-${entries.length}`, kind: "assistant", text },
  ];
}
