import { z } from "zod";
import { ASSET_TYPES, type AssetType } from "@/shared/library";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_STATUSES,
  type PipelineStageId,
  type PipelineStatus,
} from "@/shared/pipeline";

export const LIBRARY_SERVER = "remocn-library";
export const PIPELINE_SERVER = "remocn-pipeline";

export const TOOL_SERVERS = [LIBRARY_SERVER, PIPELINE_SERVER] as const;

export type ToolServer = (typeof TOOL_SERVERS)[number];

export function isToolServer(value: string): value is ToolServer {
  return (TOOL_SERVERS as readonly string[]).includes(value);
}

export interface ToolSpec {
  readonly description: string;
  readonly name: string;
  readonly shape: z.ZodRawShape;
}

export const LIST_ASSETS = "list_assets";
export const SAVE_ASSET = "save_asset";
export const START_PIPELINE = "start_video_pipeline";
export const SET_PIPELINE_STAGE = "set_pipeline_stage";

// The specs are declarative so the stdio child can register them with any
// MCP transport while the execution stays in the sidecar, where the stores
// and the turn's stream live. The wording is the contract with the agent —
// it moved here verbatim from the in-process servers.
export const TOOL_SPECS: Record<ToolServer, readonly ToolSpec[]> = {
  [LIBRARY_SERVER]: [
    {
      description:
        "List everything in the studio's asset library: images, videos, audio and finished Remotion components the person saved from earlier videos. Call it when they ask what is in the library, or ask you to reuse something without saying which reference it is.",
      name: LIST_ASSETS,
      shape: {},
    },
    {
      description:
        "Save something from this project into the studio's asset library so it can be reused in other videos. You decide the boundaries: gather every file the thing needs — the component and whatever it imports that is not a package — and give it a name and a one-line description the person would recognise. Call it when they ask to save a scene, an animation or a piece of media to the library.",
      name: SAVE_ASSET,
      shape: {
        dependencies: z
          .array(z.string())
          .optional()
          .describe(
            "npm packages the files import, beyond react and remotion — e.g. @remotion/shapes, three."
          ),
        description: z
          .string()
          .optional()
          .describe("One line saying what this is, in the person's words."),
        files: z
          .array(z.string())
          .min(1)
          .describe(
            "Every file the asset needs, as paths inside this project. Relative paths resolve against the project folder."
          ),
        name: z.string().min(1).describe("A short human name for the asset."),
        type: z
          .enum(ASSET_TYPES as unknown as [AssetType])
          .optional()
          .describe("Left out, it is worked out from the file extensions."),
      },
    },
  ],
  [PIPELINE_SERVER]: [
    {
      description:
        "Start the six-stage video production pipeline for this session: analysis, brand, script, motion, build, review. Call it once, when the person asks to create a video (or rework one from the ground up) and no pipeline is active yet. It answers with the instructions for the first stage — follow them.",
      name: START_PIPELINE,
      shape: {},
    },
    {
      description:
        "Move one stage of the video pipeline: mark the current stage done the moment its done-condition holds, and the next one active — then keep working. A review note may also reopen an earlier stage by setting it active again. It answers with the instructions for whatever stage is now active.",
      name: SET_PIPELINE_STAGE,
      shape: {
        stage: z.enum(PIPELINE_STAGE_IDS as unknown as [PipelineStageId]),
        status: z.enum(PIPELINE_STATUSES as unknown as [PipelineStatus]),
      },
    },
  ],
};
