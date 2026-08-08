import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { TaskRow } from "@/lib/studio/tasks";
import type { PipelineStageChange, PipelineState } from "@/shared/ipc";
import {
  activeStage,
  type PipelineStage,
  pipelineDone,
  type StageTemplate,
  stageTemplate,
} from "@/shared/pipeline";

export function loadPipeline(
  sessionId: string
): Effect.Effect<PipelineState, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "pipeline.get",
      params: { sessionId },
    });
  });
}

export function startPipeline(
  sessionId: string
): Effect.Effect<PipelineState, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "pipeline.start",
      params: { sessionId },
    });
  });
}

export function setPipelineStage(
  change: PipelineStageChange
): Effect.Effect<PipelineState, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "pipeline.set",
      params: change,
    });
  });
}

export interface StageRow {
  readonly stage: PipelineStage;
  readonly template: StageTemplate;
}

export function stageRows(
  stages: readonly PipelineStage[]
): readonly StageRow[] {
  return stages.map((stage) => ({
    stage,
    template: stageTemplate(stage.stage),
  }));
}

export interface PipelineProgress {
  readonly done: number;
  readonly total: number;
}

export function pipelineProgress(
  stages: readonly PipelineStage[]
): PipelineProgress | null {
  if (stages.length === 0 || pipelineDone(stages)) {
    return null;
  }

  return {
    done: stages.filter((row) => row.status === "done").length,
    total: stages.length,
  };
}

export function pipelineLabel(
  stages: readonly PipelineStage[],
  tasks: readonly TaskRow[]
): string {
  const running = tasks.find((task) => task.status === "in_progress");
  if (running !== undefined) {
    return running.activeForm ?? running.subject;
  }

  const active = activeStage(stages);
  return active === null ? "Video" : stageTemplate(active.stage).activeForm;
}
