"use client";

import { ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  targetText,
  toolDetail,
  toolFailure,
  toolTargetParts,
} from "@/lib/studio/activity";
import { cn } from "@/lib/utils";
import type { ActivityEntry, ActivityState } from "@/shared/ipc";
import { ActivityDetail } from "./activity-detail";
import { ActivityTarget } from "./activity-target";

export const DOTS: Record<ActivityState, string> = {
  done: "bg-emerald-500",
  failed: "bg-destructive",
  running: "animate-pulse bg-amber-500",
};

export function ActivityLine({
  cwd,
  entry,
}: {
  cwd: string | null;
  entry: ActivityEntry;
}) {
  const disclosure = useDisclosure();
  const detail = useMemo(() => toolDetail(entry), [entry]);
  const target = toolTargetParts(entry.input, cwd);
  const failure = entry.state === "failed" ? toolFailure(entry.result) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={detail === null ? undefined : disclosure.isOpen}
        aria-label={
          target === null ? entry.name : `${entry.name} ${targetText(target)}`
        }
        className="group flex w-full min-w-0 items-center gap-2 text-left font-mono text-xs disabled:cursor-default"
        disabled={detail === null}
        onClick={disclosure.toggle}
        type="button"
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", DOTS[entry.state])}
        />
        <span className="shrink-0 text-foreground">{entry.name}</span>
        {target === null ? null : <ActivityTarget target={target} />}
        {detail === null ? null : (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              disclosure.isOpen && "rotate-90"
            )}
          />
        )}
      </button>

      {failure === null ? null : (
        <p className="wrap-break-word whitespace-pre-wrap rounded-md bg-destructive/10 px-2 py-1 font-mono text-[0.6875rem] text-destructive">
          {failure}
        </p>
      )}

      {disclosure.isOpen && detail !== null ? (
        <ActivityDetail detail={detail} />
      ) : null}
    </div>
  );
}
