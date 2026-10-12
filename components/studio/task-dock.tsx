"use client";

import type { MouseEvent } from "react";
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
import type {
  PipelineStage,
  PipelineStageId,
  PipelineStatus,
} from "@/shared/pipeline";
import { DockSection } from "./dock";
import { TaskChecklist } from "./task-checklist";
import { TaskStatusIcon } from "./task-status-icon";

export function TaskDock({
  documents,
  onOpenDocument,
  settings,
  stages,
  tasks,
  working,
}: {
  documents?: ReadonlyMap<PipelineStageId, string>;
  onOpenDocument?: (event: MouseEvent<HTMLButtonElement>) => void;
  settings: StudioSettings | null;
  stages: readonly PipelineStage[];
  tasks: readonly TaskRow[];
  working: boolean;
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
        expanded={
          <PipelineList
            documents={documents}
            onOpenDocument={onOpenDocument}
            stages={stages}
            tasks={tasks}
            working={working}
          />
        }
        glyph={
          pipeline.done > 0 || activeTask(tasks) !== null
            ? "in_progress"
            : "pending"
        }
        label={pipelineLabel(stages, tasks, working)}
        name="Video"
        working={working}
      />
    );
  }

  const progress = taskProgress(tasks);
  if (progress === null) {
    return null;
  }

  const running = working ? activeTask(tasks) : null;
  const glyph = taskGlyph(tasks);

  return (
    <DockShell
      count={`${progress.done}/${progress.total}`}
      dock={dock}
      expanded={<TaskChecklist tasks={tasks} working={working} />}
      glyph={glyph}
      label={planLabel(running, glyph)}
      name="Plan"
      working={working}
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
  working,
}: {
  count: string;
  dock: ReturnType<typeof useTaskDock>;
  expanded: React.ReactNode;
  glyph: Parameters<typeof TaskStatusIcon>[0]["glyph"];
  label: string;
  name: string;
  working: boolean;
}) {
  return (
    <DockSection
      count={count}
      icon={<TaskStatusIcon glyph={glyph} still={!working} />}
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
  documents,
  onOpenDocument,
  stages,
  tasks,
  working,
}: {
  documents?: ReadonlyMap<PipelineStageId, string>;
  onOpenDocument?: (event: MouseEvent<HTMLButtonElement>) => void;
  stages: readonly PipelineStage[];
  tasks: readonly TaskRow[];
  working: boolean;
}) {
  return (
    <ul className="flex min-w-0 flex-col gap-0.5" data-slot="pipeline-list">
      {stageRows(stages).map(({ stage, template }) => {
        // A stage whose document is on disk is the only way most people will
        // ever find the Docs pane, so the row itself opens it. A stage that
        // has written nothing stays a plain line rather than a dead button.
        const document = documents?.get(template.id);

        return (
          <li className="flex min-w-0 flex-col" key={template.id}>
            <StageRow
              document={document}
              onOpen={onOpenDocument}
              status={stage.status}
              title={template.title}
              working={working}
            />

            {/* The turn's own plan is the active stage's sub-tasks, so it nests
              under that stage instead of standing beside it. */}
            {stage.status === "active" && tasks.length > 0 ? (
              <div className="pl-6">
                <TaskChecklist tasks={tasks} working={working} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function StageRow({
  document,
  onOpen,
  status,
  title,
  working,
}: {
  document: string | undefined;
  onOpen?: (event: MouseEvent<HTMLButtonElement>) => void;
  status: PipelineStatus;
  title: string;
  working: boolean;
}) {
  const shell = cn(
    "flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm",
    status === "active" && "bg-muted/60"
  );

  const label = (
    <>
      <TaskStatusIcon
        className="mt-0.5"
        glyph={STAGE_GLYPHS[status]}
        still={!working}
      />
      <span
        className={cn(
          "wrap-break-word min-w-0 text-pretty leading-snug",
          STAGE_TEXT[status]
        )}
      >
        {title}
      </span>
    </>
  );

  if (document === undefined || onOpen === undefined) {
    return <div className={shell}>{label}</div>;
  }

  return (
    <button
      className={cn(
        shell,
        "cursor-pointer outline-none transition-colors duration-fast ease-out hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2"
      )}
      onClick={onOpen}
      title={`Read ${nameOf(document)}`}
      type="button"
      value={document}
    >
      {label}
    </button>
  );
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
