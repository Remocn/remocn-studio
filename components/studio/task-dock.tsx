"use client";

import { ListTodoIcon, PinIcon, XIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTaskDock } from "@/hooks/use-task-dock";
import { DOCK_GAP } from "@/lib/studio/dock";
import type { StudioSettings } from "@/lib/studio/settings";
import { type TaskRow, taskProgress } from "@/lib/studio/tasks";
import { TaskChecklist } from "./task-checklist";

export function TaskDock({
  settings,
  tasks,
}: {
  settings: StudioSettings | null;
  tasks: readonly TaskRow[];
}) {
  const state = useTaskDock(tasks, settings);
  const hasTasks = tasks.length > 0;

  return (
    // The overlay is what measures the pane: it is the pane's own box, so the
    // gutter left of the centred column is read from the same element the dock
    // is positioned in rather than from a second source that could disagree.
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      ref={state.ref}
    >
      {hasTasks && state.dock.mode === "panel" ? (
        <div
          className="pointer-events-auto absolute top-4 bottom-4 flex flex-col"
          style={{ left: DOCK_GAP, width: state.dock.width }}
        >
          {/* `rounded-xl` over `p-1.5` puts the rows' `rounded-lg` exactly a
              padding's width inside the shell, so the corner gap stays even.
              Depth is the shared elevation token rather than a border: it is a
              translucent ring, so it composites over whatever of the transcript
              happens to be behind it. */}
          <section
            aria-label="Plan"
            className="flex min-h-0 flex-col rounded-xl bg-popover/95 p-1.5 shadow-[var(--elevation-floating)] backdrop-blur-md"
          >
            <PlanHeading onHide={state.show} tasks={tasks} />
            <div className="min-h-0 overflow-y-auto">
              <TaskChecklist tasks={tasks} />
            </div>
          </section>
        </div>
      ) : null}

      {hasTasks && state.dock.mode === "icon" ? (
        <div
          className="pointer-events-auto absolute top-4"
          style={{ left: DOCK_GAP }}
        >
          <Popover onOpenChange={state.setOpen} open={state.isOpen}>
            <PopoverTrigger
              render={
                <Button
                  aria-label={`Show the plan, ${label(tasks)}`}
                  className="shadow-[var(--elevation-floating)]"
                  size="icon-sm"
                  variant="outline"
                />
              }
            >
              <ListTodoIcon />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label="Plan"
              className="max-h-96 w-72 gap-0 overflow-y-auto p-1.5"
              side="right"
            >
              <PlanHeading
                onShow={state.isShown ? undefined : state.show}
                tasks={tasks}
              />
              <TaskChecklist tasks={tasks} />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </div>
  );
}

function PlanHeading({
  onHide,
  onShow,
  tasks,
}: {
  onHide?: (shown: boolean) => void;
  onShow?: (shown: boolean) => void;
  tasks: readonly TaskRow[];
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-2 pt-1 pb-1.5">
      <h3 className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
        Plan
      </h3>
      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
        {label(tasks)}
      </span>
      {onHide === undefined ? null : <HideButton onHide={onHide} />}
      {onShow === undefined ? null : <ShowButton onShow={onShow} />}
    </div>
  );
}

function HideButton({ onHide }: { onHide: (shown: boolean) => void }) {
  const hide = useCallback(() => {
    onHide(false);
  }, [onHide]);

  return (
    <Button
      aria-label="Hide the plan"
      className="-mr-1 size-6 shrink-0 text-muted-foreground"
      onClick={hide}
      size="icon-xs"
      variant="ghost"
    >
      <XIcon />
    </Button>
  );
}

function ShowButton({ onShow }: { onShow: (shown: boolean) => void }) {
  const show = useCallback(() => {
    onShow(true);
  }, [onShow]);

  return (
    <Button
      aria-label="Keep the plan beside the chat"
      className="-mr-1 size-6 shrink-0 text-muted-foreground"
      onClick={show}
      size="icon-xs"
      variant="ghost"
    >
      <PinIcon />
    </Button>
  );
}

function label(tasks: readonly TaskRow[]): string {
  const progress = taskProgress(tasks);
  return progress === null ? "empty" : `${progress.done}/${progress.total}`;
}
