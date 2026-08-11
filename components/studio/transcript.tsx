"use client";

import { memo, useMemo } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { groupActivity, type TranscriptItem } from "@/lib/studio/runs";
import { activeForm, currentTasks } from "@/lib/studio/tasks";
import type { TranscriptEntry } from "@/shared/ipc";
import { ActivityLine } from "./activity-line";
import { ActivityRun } from "./activity-run";
import { AssetRow } from "./asset-row";
import { Markdown } from "./markdown";
import { MediaRow } from "./media-row";
import { MessageText } from "./message-text";
import { TaskChecklist } from "./task-checklist";
import { Thinking } from "./thinking";

export function Transcript({
  cwd,
  entries,
  error,
  isRunning,
  isWaiting,
  now,
  startedAt,
}: {
  cwd: string | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isRunning: boolean;
  isWaiting: boolean;
  now: number;
  startedAt: number | null;
}) {
  const items = useMemo(() => groupActivity(entries), [entries]);
  const last = entries.at(-1) ?? null;
  const isThinking = isRunning && !isWaiting && last?.kind !== "assistant";
  const lastId = items.at(-1)?.id ?? null;
  const label = activeForm(currentTasks(entries));

  // The pane re-renders every second for the Thinking timer; the transcript
  // rows depend on none of that, so the element array is kept stable across
  // ticks rather than reconciling hundreds of items per second.
  const rows = useMemo(
    () =>
      items.map((item) => (
        <MessageScrollerItem key={item.id} messageId={item.id}>
          <Row
            cwd={cwd}
            isStreaming={isRunning && item.id === lastId}
            item={item}
          />
        </MessageScrollerItem>
      )),
    [cwd, isRunning, items, lastId]
  );

  return (
    <>
      {rows}

      {isThinking ? (
        <MessageScrollerItem>
          <Thinking label={label} now={now} startedAt={startedAt} />
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

function Row({
  cwd,
  isStreaming,
  item,
}: {
  cwd: string | null;
  isStreaming: boolean;
  item: TranscriptItem;
}) {
  if (item.kind === "tasks") {
    return <TaskChecklist tasks={item.tasks} />;
  }

  if (item.kind === "run") {
    return <Run cwd={cwd} entries={item.entries} />;
  }

  return <Entry cwd={cwd} entry={item.entry} isStreaming={isStreaming} />;
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
          <MediaRow items={[...entry.attachments, ...entry.media]} />
          <AssetRow items={entry.assets} />
          {entry.text.length === 0 ? null : (
            <Bubble align="end">
              <BubbleContent className="whitespace-pre-wrap">
                <MessageText
                  counts={{
                    asset: entry.assets.length,
                    element: entry.elements.length,
                    image: entry.attachments.length,
                  }}
                  text={entry.text}
                />
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
const Run = memo(ActivityRun);
