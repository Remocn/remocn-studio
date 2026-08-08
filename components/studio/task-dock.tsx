"use client";

import { ChevronUpIcon } from "lucide-react";
import { useTaskDock } from "@/hooks/use-task-dock";
import type { StudioSettings } from "@/lib/studio/settings";
import {
  activeTask,
  type TaskRow,
  taskGlyph,
  taskProgress,
} from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";
import { TaskChecklist } from "./task-checklist";
import { TaskStatusIcon } from "./task-status-icon";

export function TaskDock({
  settings,
  tasks,
}: {
  settings: StudioSettings | null;
  tasks: readonly TaskRow[];
}) {
  const dock = useTaskDock(settings);
  const running = activeTask(tasks);
  const progress = taskProgress(tasks);
  const glyph = taskGlyph(tasks);

  if (progress === null) {
    return null;
  }

  return (
    // The strip has no bottom radius and no gap under it: it abuts the composer
    // and reads as a drawer behind it. Overlapping the composer to get that
    // effect is what the earlier version did, and every version of it put an
    // edge or a shadow of ours across the input. Both live in the same
    // `max-w-2xl` column, so a pane resize reflows them together and there is
    // nothing left to measure.
    <div className="relative z-0 -mb-px shrink-0 px-4">
      {/* `px-3` inside the composer's own column is what makes the strip
          narrower than it, so it reads as coming out from behind. */}
      <div className="mx-auto w-full max-w-2xl px-3">
        {/* `bg-card` rather than a muted tint: the composer's own surface is a
            translucent lift over the background, so anything translucent here
            lands on the same colour and the two merge. The colour is the whole
            separation — the composer draws no border, and one here would be the
            only line on this edge of the screen. */}
        <div className="overflow-hidden rounded-t-xl bg-card">
          {dock.isExpanded ? (
            <div className="max-h-64 overflow-y-auto p-1.5 pb-0">
              <TaskChecklist tasks={tasks} />
            </div>
          ) : null}

          <button
            aria-expanded={dock.isExpanded}
            aria-label={`Plan, ${progress.done} of ${progress.total} done`}
            className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
            onClick={dock.toggle}
            type="button"
          >
            <TaskStatusIcon glyph={glyph} />
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                running === null ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {label(running, glyph)}
            </span>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
              {`${progress.done}/${progress.total}`}
            </span>
            <ChevronUpIcon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                dock.isExpanded && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function label(running: TaskRow | null, glyph: ReturnType<typeof taskGlyph>) {
  if (running !== null) {
    return running.activeForm ?? running.subject;
  }

  return glyph === "finished" ? "All done" : "Plan";
}
