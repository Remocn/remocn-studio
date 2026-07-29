import type {
  ClaudeEvent,
  PromptAttachment,
  PromptElement,
  TranscriptEntry,
} from "./ipc";

export function appendUser(
  entries: readonly TranscriptEntry[],
  input: {
    attachments: readonly PromptAttachment[];
    elements: readonly PromptElement[];
    text: string;
  }
): readonly TranscriptEntry[] {
  return [
    ...entries,
    {
      attachments: input.attachments,
      elements: input.elements,
      id: `user-${entries.length}`,
      kind: "user",
      text: input.text,
    },
  ];
}

export function fold(
  entries: readonly TranscriptEntry[],
  event: ClaudeEvent
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
