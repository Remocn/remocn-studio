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
  type TaskGlyph,
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
  isRunning,
  settings,
  stages,
  tasks,
}: {
  isRunning: boolean;
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
        dock={dock}
        done={pipeline.done}
        expanded={<PipelineList stages={stages} tasks={tasks} />}
        name="Video plan"
        summary={pipelineSummary(stages, tasks, pipeline.done)}
        total={pipeline.total}
      />
    );
  }

  // A task plan is live status for one assistant turn. Its checklist remains
  // in the transcript, but a settled turn must not pin that history above a
  // later conversation.
  if (!isRunning) {
    return null;
  }

  const progress = taskProgress(tasks);
  if (progress === null) {
    return null;
  }

  return (
    <DockShell
      dock={dock}
      done={progress.done}
      expanded={<TaskChecklist tasks={tasks} />}
      name="Plan"
      summary={planSummary(tasks, progress.done)}
      total={progress.total}
    />
  );
}

interface DockSummary {
  readonly detail: string | null;
  readonly glyph: TaskGlyph;
  readonly label: string;
  readonly state: "Complete" | "In progress" | "Ready" | "Up next";
}

function DockShell({
  dock,
  done,
  expanded,
  name,
  summary,
  total,
}: {
  dock: ReturnType<typeof useTaskDock>;
  done: number;
  expanded: React.ReactNode;
  name: string;
  summary: DockSummary;
  total: number;
}) {
  return (
    <DockSection
      count={`${done} of ${total}`}
      icon={<TaskStatusIcon glyph={summary.glyph} />}
      isExpanded={dock.isExpanded}
      label={
        <span className="flex min-w-0 flex-col gap-1 whitespace-normal">
          <span className="flex min-w-0 items-center gap-1.5 text-xs leading-none">
            <span className="shrink-0 font-medium text-foreground">{name}</span>
            <span className="truncate text-muted-foreground">
              {summary.state}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-sm leading-tight">
            <span className="truncate text-foreground">{summary.label}</span>
            {summary.detail === null ? null : (
              <>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground/50"
                >
                  ·
                </span>
                <span className="truncate text-muted-foreground">
                  {summary.detail}
                </span>
              </>
            )}
          </span>
        </span>
      }
      onToggle={dock.toggle}
      summary={`${name}, ${summary.state.toLowerCase()}: ${summary.label}, ${done} of ${total} complete`}
    >
      {expanded}
    </DockSection>
  );
}

function planSummary(tasks: readonly TaskRow[], done: number): DockSummary {
  const running = activeTask(tasks);
  if (running !== null) {
    return {
      detail:
        running.activeForm === null ? running.description : running.subject,
      glyph: "in_progress",
      label: running.activeForm ?? running.subject,
      state: "In progress",
    };
  }

  const glyph = taskGlyph(tasks);
  if (glyph === "finished") {
    return {
      detail: `${tasks.length} steps completed`,
      glyph,
      label: "All done",
      state: "Complete",
    };
  }

  const next = tasks.find((task) => task.status === "pending");
  return {
    detail: next?.description ?? null,
    glyph,
    label: next?.subject ?? "Plan ready",
    state: done > 0 ? "Up next" : "Ready",
  };
}

function pipelineSummary(
  stages: readonly PipelineStage[],
  tasks: readonly TaskRow[],
  done: number
): DockSummary {
  const running = activeTask(tasks);
  if (running !== null) {
    return {
      detail:
        running.activeForm === null ? running.description : running.subject,
      glyph: "in_progress",
      label: pipelineLabel(stages, tasks),
      state: "In progress",
    };
  }

  const rows = stageRows(stages);
  const current =
    rows.find(({ stage }) => stage.status === "active") ??
    rows.find(({ stage }) => stage.status === "pending");

  if (current === undefined) {
    return {
      detail: null,
      glyph: "pending",
      label: "Plan ready",
      state: "Ready",
    };
  }

  const isActive = current.stage.status === "active";
  let state: DockSummary["state"] = "Ready";
  if (isActive) {
    state = "In progress";
  } else if (done > 0) {
    state = "Up next";
  }

  return {
    detail: `${current.template.title}: ${current.template.goal}`,
    glyph: isActive ? "in_progress" : "pending",
    label: current.template.activeForm,
    state,
  };
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

const STAGE_DETAIL_TEXT: Record<PipelineStatus, string> = {
  active: "text-muted-foreground",
  done: "text-muted-foreground/50",
  pending: "text-muted-foreground/70",
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
            aria-current={stage.status === "active" ? "step" : undefined}
            className={cn(
              "flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm",
              stage.status === "active" && "bg-muted/60"
            )}
          >
            <TaskStatusIcon
              className="mt-0.5"
              glyph={STAGE_GLYPHS[stage.status]}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "wrap-break-word min-w-0 text-pretty leading-snug",
                  STAGE_TEXT[stage.status]
                )}
              >
                {template.title}
              </span>
              <span
                className={cn(
                  "wrap-break-word min-w-0 text-pretty text-xs leading-relaxed",
                  STAGE_DETAIL_TEXT[stage.status]
                )}
              >
                {template.goal}
              </span>
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
