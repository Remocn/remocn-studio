"use client";

import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  type Icon,
} from "@/components/icons";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import type { TaskGlyph } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";

const ICONS: Record<Exclude<TaskGlyph, "finished" | "in_progress">, Icon> = {
  completed: CircleCheckIcon,
  pending: CircleDashedIcon,
};

const STATES: Record<Exclude<TaskGlyph, "finished" | "in_progress">, string> = {
  completed: "text-muted-foreground",
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
  still = false,
}: {
  className?: string;
  glyph: TaskGlyph;
  still?: boolean;
}) {
  if (glyph === "finished") {
    // A whole plan finished is not one more completed row: the dashed ring is
    // the checklist's own outline, and the filled disc inside it is what says
    // there is nothing left in it.
    return (
      <span
        aria-label={LABELS.finished}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-success/50 border-dashed",
          className
        )}
        role="img"
      >
        <span className="flex size-2.5 items-center justify-center rounded-full bg-success">
          <CheckIcon className="size-1.5 text-background" strokeWidth={4} />
        </span>
      </span>
    );
  }

  if (glyph === "in_progress") {
    return (
      <DotmSquare1
        animated={!still}
        ariaLabel={LABELS.in_progress}
        className={cn("size-4 shrink-0 text-foreground", className)}
        dotSize={2}
        role="img"
        size={16}
      />
    );
  }

  const Glyph = ICONS[glyph];

  return (
    <Glyph
      aria-label={LABELS[glyph]}
      className={cn("size-4 shrink-0", STATES[glyph], className)}
    />
  );
}
