import { z } from "zod";
import { ASSET_TYPES, type AssetType } from "@/shared/library";
import { MOTION_ROLES, type MotionRole } from "@/shared/motion";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_STATUSES,
  type PipelineStageId,
  type PipelineStatus,
} from "@/shared/pipeline";

export const LIBRARY_SERVER = "remocn-library";
export const PIPELINE_SERVER = "remocn-pipeline";
export const DESIGN_SERVER = "remocn-design";

export const TOOL_SERVERS = [
  DESIGN_SERVER,
  LIBRARY_SERVER,
  PIPELINE_SERVER,
] as const;

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
export const REQUEST_SOURCE_ASSET = "request_source_asset";
export const DESIGN_CHECK = "design_check";

const MOTION_SELECTOR = z
  .string()
  .min(1)
  .describe(
    "A CSS selector naming the element; prefer the stable [data-design-id='…'] the scene authored."
  );

// The specs are declarative so the stdio child can register them with any
// MCP transport while the execution stays in the sidecar, where the stores
// and the turn's stream live. The wording is the contract with the agent —
// it moved here verbatim from the in-process servers.
export const TOOL_SPECS: Record<ToolServer, readonly ToolSpec[]> = {
  [DESIGN_SERVER]: [
    {
      description:
        "Mechanically review 2–9 key frames of Main before calling a scene finished. It renders temporary snapshots and reports measurable WCAG contrast, clipped/occluded/out-of-frame text, and a timeline that did not visibly advance. Pass the movements video/motion.md promises as motion assertions so the check verifies the declared motion instead of guessing; a selector that matches nothing or several elements is its own finding, never a silent pass. Fix every finding or explain why it is intentional; inspect the returned snapshot paths for design judgement the checks cannot make.",
      name: DESIGN_CHECK,
      shape: {
        frames: z
          .array(z.number().int().min(0))
          .min(2)
          .max(9)
          .refine((frames) => new Set(frames).size === frames.length, {
            message: "frames must be distinct",
          })
          .describe(
            "Two to nine distinct key frames from Main, normally the settled hero moments and one motion-separated pair."
          ),
        motion: z
          .array(
            z.discriminatedUnion("kind", [
              z
                .object({
                  from: z.number().int().min(0),
                  kind: z.literal("changes_between"),
                  selector: MOTION_SELECTOR,
                  to: z.number().int().min(0),
                })
                .refine((row) => row.from !== row.to, {
                  message: "from and to must be different frames",
                }),
              z.object({
                frame: z.number().int().min(0),
                kind: z.literal("visible_at"),
                selector: MOTION_SELECTOR,
              }),
              z.object({
                kind: z.literal("stays_in_frame"),
                selector: MOTION_SELECTOR,
              }),
            ])
          )
          .max(12)
          .optional()
          .describe(
            "Explicit expectations from video/motion.md: changes_between says the element or its content visibly changed between two frames, visible_at says it is visible by a frame, stays_in_frame says it never leaves the canvas on the checked frames."
          ),
      },
    },
  ],
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
        role: z
          .enum(MOTION_ROLES as unknown as [MotionRole])
          .optional()
          .describe(
            "When in the life of the thing it is attached to this behaviour runs: entry, emphasis, exit, scene or transition. Media has no role; leave it out when nothing fits."
          ),
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
        "Ask the person how to supply an identity asset after you tried and failed to recover the original from its authoritative source. Use this only after checking direct downloads, page image sources and source sets, and linked SVGs. The answer gives you a real project-relative path or says the ask was cancelled; drawing, tracing or restyling the asset is never the fallback.",
      name: REQUEST_SOURCE_ASSET,
      shape: {
        attempt: z
          .string()
          .min(1)
          .describe(
            "What you checked on the source and why none of it yielded a usable original."
          ),
        name: z
          .string()
          .min(1)
          .describe("The human name of the required identity asset."),
        source: z
          .string()
          .url()
          .describe("The authoritative HTTP(S) page or file URL."),
      },
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
