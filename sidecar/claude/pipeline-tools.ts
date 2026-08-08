import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { errorMessage } from "@/lib/error-message";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_STATUSES,
  type PipelineStage,
  type PipelineStageId,
  type PipelineStatus,
} from "@/shared/pipeline";
import { pipelineBrief } from "./conventions";

export const PIPELINE_SERVER = "remocn-pipeline";

export const PIPELINE_TOOL_PREFIX = `mcp__${PIPELINE_SERVER}__`;

export interface PipelineControls {
  readonly setStage: (
    stage: PipelineStageId,
    status: PipelineStatus
  ) => Promise<readonly PipelineStage[]>;
  readonly start: () => Promise<readonly PipelineStage[]>;
}

export function pipelineServer(controls: PipelineControls) {
  return createSdkMcpServer({
    name: PIPELINE_SERVER,
    tools: [
      tool(
        "start_video_pipeline",
        "Start the six-stage video production pipeline for this session: analysis, brand, script, motion, build, review. Call it once, when the person asks to create a video (or rework one from the ground up) and no pipeline is active yet. It answers with the instructions for the first stage — follow them.",
        {},
        () => attempt(controls.start)
      ),
      tool(
        "set_pipeline_stage",
        "Move one stage of the video pipeline: mark the current stage done the moment its done-condition holds, and the next one active — then keep working. A review note may also reopen an earlier stage by setting it active again. It answers with the instructions for whatever stage is now active.",
        {
          stage: z.enum(PIPELINE_STAGE_IDS as unknown as [PipelineStageId]),
          status: z.enum(PIPELINE_STATUSES as unknown as [PipelineStatus]),
        },
        (args) => attempt(() => controls.setStage(args.stage, args.status))
      ),
    ],
  });
}

async function attempt(run: () => Promise<readonly PipelineStage[]>) {
  try {
    const stages = await run();
    const brief = pipelineBrief(stages);

    return {
      content: [
        {
          text: `${JSON.stringify(stages)}${brief === null ? "" : `\n\n${brief}`}`,
          type: "text" as const,
        },
      ],
    };
  } catch (cause) {
    return {
      content: [{ text: errorMessage(cause), type: "text" as const }],
      isError: true,
    };
  }
}
