"use client";

import { ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { targetText, toolTargetParts } from "@/lib/studio/activity";
import { runSummary } from "@/lib/studio/runs";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/shared/ipc";
import { ActivityLine, DOTS } from "./activity-line";
import { ActivityTarget } from "./activity-target";

export function ActivityRun({
  cwd,
  entries,
  isStreaming,
}: {
  cwd: string | null;
  entries: readonly ActivityEntry[];
  isStreaming: boolean;
}) {
  const disclosure = useDisclosure();
  const summary = useMemo(() => runSummary(entries, cwd), [cwd, entries]);
  const newest = entries.at(-1) ?? null;
  const ticker =
    isStreaming && newest !== null ? toolTargetParts(newest.input, cwd) : null;
  const name = ticker === null ? summary.name : (newest?.name ?? summary.name);
  const isRunning = entries.some((entry) => entry.state === "running");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={disclosure.isOpen}
        aria-label={
          ticker === null ? summary.text : `${name} ${targetText(ticker)}`
        }
        className="group flex w-full min-w-0 items-center gap-2 text-left font-mono text-xs"
        onClick={disclosure.toggle}
        type="button"
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            DOTS[isRunning ? "running" : "done"]
          )}
        />
        <span className="shrink-0 text-foreground">{name}</span>
        {ticker === null ? (
          <span className="truncate text-muted-foreground group-hover:text-foreground">
            {summary.detail}
          </span>
        ) : (
          <ActivityTarget target={ticker} />
        )}
        <ChevronRightIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            disclosure.isOpen && "rotate-90"
          )}
        />
      </button>

      {disclosure.isOpen ? (
        <div className="flex min-w-0 flex-col gap-1 pl-3.5">
          {entries.map((entry) => (
            <ActivityLine cwd={cwd} entry={entry} key={entry.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
