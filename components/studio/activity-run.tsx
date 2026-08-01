"use client";

import { ChevronDownIcon } from "lucide-react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { targetText, toolTargetParts } from "@/lib/studio/activity";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/shared/ipc";
import { ActivityIcon } from "./activity-icon";
import { ActivityLine } from "./activity-line";
import { ActivityTarget } from "./activity-target";

export function ActivityRun({
  cwd,
  entries,
}: {
  cwd: string | null;
  entries: readonly ActivityEntry[];
}) {
  const disclosure = useDisclosure();
  const newest = entries.at(-1);

  if (newest === undefined) {
    return null;
  }

  const target = toolTargetParts(newest.input, cwd);
  const hidden = entries.length - 1;
  const state = entries.some((entry) => entry.state === "running")
    ? "running"
    : newest.state;
  const label =
    target === null ? newest.name : `${newest.name} ${targetText(target)}`;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={disclosure.isOpen}
        aria-label={`${label}, ${hidden} more`}
        className="group flex w-full min-w-0 items-center gap-2 rounded-md text-left font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={disclosure.toggle}
        type="button"
      >
        <ActivityIcon name={newest.name} state={state} />
        <span className="shrink-0 text-foreground">{newest.name}</span>
        {target === null ? null : <ActivityTarget target={target} />}
        <span className="shrink-0 text-muted-foreground tabular-nums">{`+${hidden}`}</span>
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            disclosure.isOpen && "rotate-180"
          )}
        />
      </button>

      {disclosure.isOpen ? (
        <div className="flex min-w-0 flex-col gap-1 border-border/60 border-l pl-3">
          {entries.map((entry) => (
            <ActivityLine cwd={cwd} entry={entry} key={entry.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
