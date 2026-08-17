"use client";

import { useTaskDock } from "@/hooks/use-task-dock";
import {
  pipelineLabel,
  pipelineProgress,
  stageRows,
} from "@/lib/studio/pipeline";
import type { StudioSettings } from "@/lib/studio/settings";
import {
  activeTask,
  type TaskRow,
  taskGlyph,
  taskProgress,
} from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";
import type { PipelineStage, PipelineStatus } from "@/shared/pipeline";
import { DockSection } from "./dock";
import { TaskChecklist } from "./task-checklist";
import { TaskStatusIcon } from "./task-status-icon";

export function TaskDock({
  settings,
  stages,
  tasks,
}: {
  settings: StudioSettings | null;
  stages: readonly PipelineStage[];
  tasks: readonly TaskRow[];
}) {
  const dock = useTaskDock(settings);
  const pipeline = pipelineProgress(stages);

  // A finished pipeline leaves the dock to the turn's own plan; an unfinished
  // one is always on screen — between turns and on a reopened session too, so
  // the six stages read as "where we are" rather than as one turn's plan.
  if (pipeline !== null) {
    return (
      <DockShell
        count={`${pipeline.done}/${pipeline.total}`}
        dock={dock}
        expanded={<PipelineList stages={stages} tasks={tasks} />}
        glyph={
          pipeline.done > 0 || activeTask(tasks) !== null
            ? "in_progress"
            : "pending"
        }
        label={pipelineLabel(stages, tasks)}
        name="Video"
      />
    );
  }

  const progress = taskProgress(tasks);
  if (progress === null) {
    return null;
  }

  const running = activeTask(tasks);
  const glyph = taskGlyph(tasks);

  return (
    <DockShell
      count={`${progress.done}/${progress.total}`}
      dock={dock}
      expanded={<TaskChecklist tasks={tasks} />}
      glyph={glyph}
      label={planLabel(running, glyph)}
      name="Plan"
    />
  );
}

function DockShell({
  count,
  dock,
  expanded,
  glyph,
  label,
  name,
}: {
  count: string;
  dock: ReturnType<typeof useTaskDock>;
  expanded: React.ReactNode;
  glyph: Parameters<typeof TaskStatusIcon>[0]["glyph"];
  label: string;
  name: string;
}) {
  return (
    <DockSection
      count={count}
      icon={<TaskStatusIcon glyph={glyph} />}
      isExpanded={dock.isExpanded}
      label={label}
      onToggle={dock.toggle}
      summary={`${name}, ${count} done`}
    >
      {expanded}
    </DockSection>
  );
}

function planLabel(
  running: TaskRow | null,
  glyph: ReturnType<typeof taskGlyph>
) {
  if (running !== null) {
    return running.activeForm ?? running.subject;
  }

  return glyph === "finished" ? "All done" : "Plan";
}

const STAGE_TEXT: Record<PipelineStatus, string> = {
  active: "text-foreground",
  done: "text-muted-foreground line-through decoration-muted-foreground/50",
  pending: "text-muted-foreground",
};

const STAGE_GLYPHS: Record<
  PipelineStatus,
  Parameters<typeof TaskStatusIcon>[0]["glyph"]
> = {
  active: "in_progress",
  done: "completed",
  pending: "pending",
};

function PipelineList({
  stages,
  tasks,
}: {
  stages: readonly PipelineStage[];
  tasks: readonly TaskRow[];
}) {
  return (
    <ul className="flex min-w-0 flex-col gap-0.5" data-slot="pipeline-list">
      {stageRows(stages).map(({ stage, template }) => (
        <li className="flex min-w-0 flex-col" key={template.id}>
          <div
            className={cn(
              "flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
              stage.status === "active" && "bg-muted/60"
            )}
          >
            <TaskStatusIcon
              className="mt-0.5"
              glyph={STAGE_GLYPHS[stage.status]}
            />
            <span
              className={cn(
                "wrap-break-word min-w-0 text-pretty leading-snug",
                STAGE_TEXT[stage.status]
              )}
            >
              {template.title}
            </span>
          </div>

          {/* The turn's own plan is the active stage's sub-tasks, so it nests
              under that stage instead of standing beside it. */}
          {stage.status === "active" && tasks.length > 0 ? (
            <div className="pl-6">
              <TaskChecklist tasks={tasks} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
