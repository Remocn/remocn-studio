"use client";

import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotDashedIcon,
  type LucideIcon,
} from "lucide-react";
import type { TaskGlyph } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";

const ICONS: Record<Exclude<TaskGlyph, "finished">, LucideIcon> = {
  completed: CircleCheckIcon,
  in_progress: CircleDotDashedIcon,
  pending: CircleDashedIcon,
};

const STATES: Record<Exclude<TaskGlyph, "finished">, string> = {
  completed: "text-muted-foreground",
  in_progress: "animate-pulse text-amber-500",
  pending: "text-muted-foreground/60",
};

const LABELS: Record<TaskGlyph, string> = {
  completed: "Completed",
  finished: "All done",
  in_progress: "In progress",
  pending: "Pending",
};

export function TaskStatusIcon({
  className,
  glyph,
}: {
  className?: string;
  glyph: TaskGlyph;
}) {
  if (glyph === "finished") {
    // A whole plan finished is not one more completed row: the dashed ring is
    // the checklist's own outline, and the filled disc inside it is what says
    // there is nothing left in it.
    return (
      <span
        aria-label={LABELS.finished}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-emerald-500/50 border-dashed",
          className
        )}
        role="img"
      >
        <span className="flex size-2.5 items-center justify-center rounded-full bg-emerald-500">
          <CheckIcon className="size-1.5 text-background" strokeWidth={4} />
        </span>
      </span>
    );
  }

  const Icon = ICONS[glyph];

  return (
    <Icon
      aria-label={LABELS[glyph]}
      className={cn("size-4 shrink-0", STATES[glyph], className)}
    />
  );
}
