"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { useTranscriptItems } from "@/hooks/use-transcript-items";
import { isDesignCheck } from "@/lib/studio/design-review";
import {
  type LiveLine,
  reasoningLines,
  workedLabel,
} from "@/lib/studio/reasoning";
import type { TranscriptItem } from "@/lib/studio/runs";
import { activeForm, currentTasks } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/shared/ipc";
import { ActivityLine } from "./activity-line";
import { ActivityRun } from "./activity-run";
import { AssetRow } from "./asset-row";
import { FailureText } from "./failure-text";
import { Markdown } from "./markdown";
import { MediaRow } from "./media-row";
import { MessageText } from "./message-text";
import { ReasoningSteps } from "./reasoning-steps";
import { SoundResultCard } from "./sound-result-card";
import { TaskChecklist } from "./task-checklist";

const NO_LINES: readonly LiveLine[] = [];

export function Transcript({
  cwd,
  entries,
  error,
  isRunning,
  isWaiting,
  live = NO_LINES,
  now,
  startedAt,
  workedMs = null,
}: {
  cwd: string | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isRunning: boolean;
  isWaiting: boolean;
  live?: readonly LiveLine[];
  now: number;
  startedAt: number | null;
  workedMs?: number | null;
}) {
  const items = useTranscriptItems(entries);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);
  const latestUser = entries.findLastIndex((entry) => entry.kind === "user");
  const quiet = latestUser >= 0;
  const { technical, shown } = useMemo(() => {
    const technicalIds = new Set(
      entries
        .slice(latestUser + 1)
        .filter(
          (entry) =>
            entry.kind === "activity" &&
            entry.state !== "failed" &&
            !isDesignCheck(entry.name)
        )
        .map((entry) => entry.id)
    );
    return {
      shown: quiet
        ? items.filter(
            (item) => item.kind === "tasks" || !technicalIds.has(item.id)
          )
        : items,
      technical: items
        .filter((item) => item.kind !== "tasks" && technicalIds.has(item.id))
        .flatMap((item): TranscriptItem[] =>
          item.kind === "run"
            ? item.entries.map((entry) => ({
                entry,
                id: entry.id,
                kind: "entry",
              }))
            : [item]
        ),
    };
  }, [entries, items, latestUser, quiet]);
  const last = entries.at(-1) ?? null;
  const isThinking = isRunning && !isWaiting && last?.kind !== "assistant";
  const lastItem = items.at(-1);
  const lastId = lastItem ? lastItem.id : null;
  const label = activeForm(currentTasks(entries));
  const lines = useMemo(
    () => reasoningLines(live, entries, cwd),
    [cwd, entries, live]
  );

  // The pane re-renders every second for the Thinking timer; the transcript
  // rows depend on none of that, so the element array is kept stable across
  // ticks rather than reconciling hundreds of items per second.
  const rows = useMemo(
    () =>
      shown.map((item) => (
        <MessageScrollerItem key={item.id} messageId={item.id}>
          <Row
            cwd={cwd}
            isRunning={isRunning}
            isStreaming={isRunning && item.id === lastId}
            item={item}
          />
        </MessageScrollerItem>
      )),
    [cwd, isRunning, shown, lastId]
  );

  return (
    <>
      {rows}

      {isThinking || (quiet && technical.length > 0) ? (
        <MessageScrollerItem>
          <div className="flex min-w-0 flex-col gap-2">
            {isThinking ? (
              <div className="flex min-w-0 items-start gap-2">
                <ReasoningSteps
                  label={label}
                  lines={lines}
                  now={now}
                  startedAt={startedAt}
                />
                {technical.length > 0 ? (
                  <button
                    aria-expanded={expanded}
                    aria-label="Show every step"
                    className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
                    onClick={toggleExpanded}
                    type="button"
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={expanded ? "size-3.5 rotate-90" : "size-3.5"}
                    />
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                aria-expanded={expanded}
                className="flex w-fit items-center gap-1 rounded text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
                onClick={toggleExpanded}
                type="button"
              >
                {workedLabel(workedMs, technical.length)}
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    expanded && "rotate-180"
                  )}
                />
              </button>
            )}
            {expanded
              ? technical.map((item) => (
                  <Row
                    cwd={cwd}
                    isRunning={isRunning}
                    isStreaming={false}
                    item={item}
                    key={item.id}
                  />
                ))
              : null}
          </div>
        </MessageScrollerItem>
      ) : null}

      {error === null ? null : (
        <MessageScrollerItem>
          <div className="rounded-xl bg-destructive/10 px-3 py-2 text-destructive text-sm">
            <FailureText
              fallback="The turn stopped because something went wrong."
              role="alert"
              text={error}
            />
          </div>
        </MessageScrollerItem>
      )}
    </>
  );
}

function Row({
  cwd,
  isRunning,
  isStreaming,
  item,
}: {
  cwd: string | null;
  isRunning: boolean;
  isStreaming: boolean;
  item: TranscriptItem;
}) {
  if (item.kind === "tasks") {
    return <TaskChecklist tasks={item.tasks} working={isRunning} />;
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
            <Bubble align="end" variant="secondary">
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
            <BubbleContent className="leading-relaxed">
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

  if (entry.kind === "sound") {
    return (
      <SoundResultCard key={entry.result.operationId} result={entry.result} />
    );
  }

  return <ActivityLine cwd={cwd} entry={entry} />;
}

const Entry = memo(EntryBlock);
const Run = memo(ActivityRun);
