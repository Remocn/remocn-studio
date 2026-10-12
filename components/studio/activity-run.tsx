"use client";

import { ChevronDownIcon } from "@/components/icons";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  activityTarget,
  targetText,
  toolFailure,
  toolName,
} from "@/lib/studio/activity";
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

  const target = activityTarget(newest, cwd);
  const name = toolName(newest.name);
  const hidden = entries.length - 1;
  const repeatedFailure = entries.every((entry) => entry.state === "failed");
  const state = entries.some((entry) => entry.state === "running")
    ? "running"
    : newest.state;
  const label = target === null ? name : `${name} ${targetText(target)}`;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={disclosure.isOpen}
        aria-label={`${label}, ${hidden} more`}
        className="group flex w-full min-w-0 items-center gap-2 rounded-md text-left font-mono text-xs outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
        onClick={disclosure.toggle}
        type="button"
      >
        <ActivityIcon name={newest.name} state={state} verb={newest.verb} />
        <span className="shrink-0 text-foreground">{name}</span>
        {target === null ? null : <ActivityTarget target={target} />}
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {repeatedFailure ? `${entries.length} attempts` : `+${hidden}`}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            disclosure.isOpen && "rotate-180"
          )}
        />
      </button>

      {repeatedFailure ? (
        <p className="wrap-break-word rounded-md bg-destructive/10 px-2 py-1 font-mono text-2xs text-destructive">
          {toolFailure(newest.result)}
        </p>
      ) : null}

      {disclosure.isOpen ? (
        <div className="flex min-w-0 flex-col gap-1 border-border/60 border-l pl-3">
          {entries.map((entry) => (
            <ActivityLine
              cwd={cwd}
              entry={entry}
              hideFailure={repeatedFailure}
              key={entry.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
