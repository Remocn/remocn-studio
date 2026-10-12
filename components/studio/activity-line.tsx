"use client";

import { useMemo } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  activityTarget,
  targetText,
  toolDetail,
  toolFailure,
  toolName,
} from "@/lib/studio/activity";
import { designReview } from "@/lib/studio/design-review";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/shared/ipc";
import { ActivityDetail } from "./activity-detail";
import { ActivityIcon } from "./activity-icon";
import { ActivityTarget } from "./activity-target";
import { DesignReview } from "./design-review";

export function ActivityLine({
  cwd,
  entry,
  hideFailure = false,
}: {
  cwd: string | null;
  entry: ActivityEntry;
  hideFailure?: boolean;
}) {
  const disclosure = useDisclosure();
  const detail = useMemo(() => toolDetail(entry), [entry]);
  const target = activityTarget(entry, cwd);
  const name = toolName(entry.name);
  const review = useMemo(
    () => (entry.state === "done" ? designReview(entry) : null),
    [entry]
  );
  const failure =
    entry.state === "failed" && !hideFailure
      ? (toolFailure(entry.result) ??
        "The tool did not complete. No diagnostic output was returned.")
      : null;

  if (review !== null) {
    return <DesignReview raw={entry.result ?? ""} review={review} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={detail === null ? undefined : disclosure.isOpen}
        aria-label={target === null ? name : `${name} ${targetText(target)}`}
        className="group flex w-full min-w-0 items-center gap-2 rounded-md text-left font-mono text-xs outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:cursor-default"
        disabled={detail === null}
        onClick={disclosure.toggle}
        type="button"
      >
        <ActivityIcon name={entry.name} state={entry.state} verb={entry.verb} />
        <span className="shrink-0 text-foreground">{name}</span>
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
        <p className="wrap-break-word whitespace-pre-wrap rounded-md bg-destructive/10 px-2 py-1 font-mono text-2xs text-destructive">
          {failure}
        </p>
      )}

      {disclosure.isOpen && detail !== null ? (
        <ActivityDetail detail={detail} />
      ) : null}
    </div>
  );
}
