"use client";

import { memo } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import type { TranscriptEntry } from "@/shared/ipc";
import { ActivityLine } from "./activity-line";
import { AttachmentRow } from "./attachment-row";
import { Markdown } from "./markdown";
import { Thinking } from "./thinking";

export function Transcript({
  cwd,
  entries,
  error,
  isRunning,
  isWaiting,
}: {
  cwd: string | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isRunning: boolean;
  isWaiting: boolean;
}) {
  const last = entries.at(-1) ?? null;
  const isThinking = isRunning && !isWaiting && last?.kind !== "assistant";

  return (
    <>
      {entries.map((entry) => (
        <MessageScrollerItem key={entry.id} messageId={entry.id}>
          <Entry
            cwd={cwd}
            entry={entry}
            isStreaming={isRunning && entry.id === last?.id}
          />
        </MessageScrollerItem>
      ))}

      {isThinking ? (
        <MessageScrollerItem>
          <Thinking />
        </MessageScrollerItem>
      ) : null}

      {error === null ? null : (
        <MessageScrollerItem>
          <p
            className="rounded-xl bg-destructive/10 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        </MessageScrollerItem>
      )}
    </>
  );
}

function EntryBlock({
  cwd,
  entry,
  isStreaming,
}: {
  cwd: string | null;
  entry: TranscriptEntry;
  isStreaming: boolean;
}) {
  if (entry.kind === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <AttachmentRow items={entry.attachments} />
          {entry.text.length === 0 ? null : (
            <Bubble align="end">
              <BubbleContent className="whitespace-pre-wrap">
                {entry.text}
              </BubbleContent>
            </Bubble>
          )}
        </MessageContent>
      </Message>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <Message>
        <MessageContent>
          <Bubble variant="ghost">
            <BubbleContent>
              <Markdown isStreaming={isStreaming}>{entry.text}</Markdown>
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  if (entry.kind === "notice") {
    return <p className="text-muted-foreground text-xs">{entry.text}</p>;
  }

  return <ActivityLine cwd={cwd} entry={entry} />;
}

const Entry = memo(EntryBlock);
