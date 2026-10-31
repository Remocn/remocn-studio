import { z } from "zod";
import { ASSET_TYPES, type AssetType } from "@/shared/library";
import { MOTION_ROLES, type MotionRole } from "@/shared/motion";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_STATUSES,
  type PipelineStageId,
  type PipelineStatus,
} from "@/shared/pipeline";
import { SOUND_FORMATS } from "@/shared/sound-effects";

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
  readonly outward?: boolean;
  readonly shape: z.ZodRawShape;
}

export function isOutwardTool(name: string): boolean {
  return TOOL_SERVERS.some((server) =>
    TOOL_SPECS[server].some(
      (spec) => spec.name === name && spec.outward === true
    )
  );
}

export const LIST_ASSETS = "list_assets";
export const LIST_CONNECTIONS = "list_connections";
export const GENERATE_SPEECH = "generate_speech";
export const GENERATE_MUSIC = "generate_music";
export const MUSIC_STATUS = "music_status";
export const GENERATE_SOUND = "generate_sound_effect";
export const SOUND_STATUS = "sound_effect_status";
export const SAVE_ASSET = "save_asset";
export const SEARCH_STOCK = "search_stock";
export const GET_MOODBOARD = "get_moodboard";
export const SAVE_MOODBOARD = "save_moodboard";
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
        "Use mode=full before export to check all seven readiness groups, automatically discover v2 MotionReview contracts and prioritize their entry/reading/exit boundaries, real audio mixdown, evidence and explicit incomplete coverage. Legacy mode reviews 2–9 key frames for contrast, clipped/occluded/out-of-frame text and declared motion. Pass only behavior promised in this video's docs/motion.md as motion assertions; missing or ambiguous selectors remain findings. For choreography, add `video` with a scene map, including a single continuous shot if appropriate. Duration distribution, shared visible ids, sampled holds and camera transforms are diagnostics to compare with the brief and primary reference; they are not quotas for cuts, decoration or motion. Inspect returned images and actual event sequences for hierarchy, causality, continuity and reading time. Fix measured defects, preserve intentional holds and cuts, and review coverage and stale/failed checks before claiming completion. Inspect readiness.coverage.motion for missing or unvisited event frames. A passing checker is not a creative verdict.",
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
            "Two to nine distinct key frames for legacy sampled mode. Omit in full mode."
          )
          .optional(),
        mode: z
          .enum(["sampled", "full", "report"])
          .optional()
          .describe(
            "Use full before export: automatically plans composition-wide visual and actual audio mix checks with explicit coverage. Omit for legacy key-frame review."
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
              z
                .object({
                  from: z.number().int().min(0),
                  kind: z.literal("keeps_moving"),
                  maxStaticFrames: z.number().int().min(1),
                  selector: MOTION_SELECTOR,
                  to: z.number().int().min(0),
                })
                .refine((row) => row.to > row.from, {
                  message: "to must be after from",
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
            "Explicit expectations from video/motion.md: changes_between says the element or its content visibly changed between two frames, visible_at says it is visible by a frame, keeps_moving limits a selected element's longest unchanged hold inside one bounded scene interval, and stays_in_frame says it never leaves the canvas on the checked frames."
          ),
        options: z
          .object({
            audio: z
              .object({
                expected: z.boolean().optional(),
                expectedIntervals: z
                  .array(
                    z.object({
                      from: z.number().int().min(0),
                      to: z.number().int().min(1),
                    })
                  )
                  .optional(),
                maskingDb: z.number().min(0).max(30).optional(),
                peakDb: z.number().min(-20).max(0).optional(),
                silenceDb: z.number().min(-120).max(-10).optional(),
                silenceIntervals: z
                  .array(
                    z.object({
                      from: z.number().int().min(0),
                      to: z.number().int().min(1),
                    })
                  )
                  .optional(),
                speechIntervals: z
                  .array(
                    z.object({
                      from: z.number().int().min(0),
                      to: z.number().int().min(1),
                    })
                  )
                  .optional(),
                stems: z
                  .array(
                    z.object({
                      inputProps: z.record(z.string(), z.unknown()),
                      role: z.enum(["speech", "music", "sfx"]),
                    })
                  )
                  .max(8)
                  .optional()
                  .describe(
                    "Props that isolate each role in the same composition. Each stem is actually rendered; timeline must remain unchanged."
                  ),
              })
              .optional(),
            charactersPerSecond: z.number().min(1).max(100).optional(),
            exceptions: z
              .array(
                z.object({
                  code: z.string().min(1),
                  from: z.number().int().min(0),
                  reason: z.string().min(1),
                  revision: z.string().min(1),
                  selector: z.string().nullable(),
                  targetId: z.string().optional(),
                  to: z.number().int().min(1),
                })
              )
              .max(100)
              .optional()
              .describe(
                "Narrow intentional exceptions bound to the prior report revision, rule, element and frame interval."
              ),
            exportSettings: z.record(z.string(), z.unknown()).optional(),
            inputProps: z.record(z.string(), z.unknown()).optional(),
            insets: z
              .object({
                bottom: z.number().min(0),
                left: z.number().min(0),
                right: z.number().min(0),
                top: z.number().min(0),
              })
              .optional()
              .describe(
                "Explicit safe area insets in composition pixels; required for custom and override any platform defaults."
              ),
            language: z.string().optional(),
            maxDurationMs: z.number().int().min(1000).max(3_600_000).optional(),
            maxFrames: z.number().int().min(4).max(5000).optional(),
            platform: z
              .enum(["tiktok", "reels", "shorts", "custom"])
              .optional(),
            readableOpacity: z.number().min(0.1).max(1).optional(),
            readingLeadSeconds: z.number().min(0).max(10).optional(),
            sampleEveryFrames: z.number().int().min(1).max(3600).optional(),
            wordsPerMinute: z.number().min(30).max(1000).optional(),
          })
          .optional(),
        video: z
          .object({
            camera: z
              .string()
              .min(1)
              .nullish()
              .describe(
                "A CSS selector for a camera wrapper to measure. Omit it or use null for a locked view without a camera assertion; camera movement is optional."
              ),
            scenes: z
              .array(
                z.object({
                  from: z.number().int().min(0),
                  name: z.string().min(1),
                  to: z.number().int().min(1),
                })
              )
              .min(1)
              .max(500)
              .describe(
                "Shots in playback order, from inclusive and to exclusive in frames. A continuous shot can be one scene with multiple internal beats. Transition overlap is sampled on both sides; shared design ids are observations, not proof of perceptual continuity."
              ),
          })
          .optional()
          .describe(
            "The whole video, for the choreography pass. It samples the composition end to end and reports the spread of the scene durations, the scene changes with nothing visible on both sides, the longest stretch in which nothing in the frame changed, and a declared camera that never moves. Pass it once for the video, not once per scene."
          ),
      },
    },
  ],
  [LIBRARY_SERVER]: [
    {
      description:
        "Generate requested narration using an OpenRouter connection and always elevenlabs/eleven-v4. Never substitute Turbo or an older model. Read the video's scene plan and script first. Choose vocal emotion and pacing for each scene, then place concise square-bracket delivery tags where delivery changes. Keep sound effects in separate cues when they need precise timing. Studio asks before spending credits and saves the MP3 to the library. Check sound_effect_status to recover an existing operation instead of repeating it.",
      name: GENERATE_SPEECH,
      shape: {
        connectionId: z.string().min(1),
        durationSeconds: z.null().default(null),
        format: z.literal("mp3").default("mp3"),
        model: z
          .literal("elevenlabs/eleven-v4")
          .default("elevenlabs/eleven-v4"),
        name: z.string().trim().min(1).max(5000),
        text: z
          .string()
          .trim()
          .min(1)
          .refine(
            (value) => Array.from(value).length <= 10_000,
            "Speech is limited to 10,000 characters."
          ),
        voice: z
          .enum([
            "george",
            "sarah",
            "adam",
            "alice",
            "bella",
            "bill",
            "brian",
            "callum",
            "charlie",
            "chris",
            "daniel",
            "eric",
            "harry",
            "jessica",
            "laura",
            "liam",
            "lily",
            "matilda",
            "river",
            "roger",
            "will",
          ])
          .default("george"),
      },
    },
    {
      description:
        "Generate music only when requested. List connections first and choose an OpenRouter or ElevenLabs connection ID. OpenRouter uses Lyria 3 Pro, with duration and instrumental preferences requested through the prompt rather than guaranteed. OpenRouter music is limited to 600 seconds. Use instrumental music by default; allow vocals only when requested. Studio asks for approval before spending credits and saves the result to the library without editing the project. Never repeat an uncertain generation: check music_status with its operation ID. Each new generation needs new approval.",
      name: GENERATE_MUSIC,
      shape: {
        connectionId: z.string().min(1),
        durationSeconds: z.number().min(3).max(600).nullable().default(null),
        forceInstrumental: z.boolean().default(true),
        format: z.literal("mp3_44100_128").default("mp3_44100_128"),
        name: z.string().trim().min(1).max(5000),
        text: z.string().trim().min(1).max(4100),
      },
    },
    {
      description:
        "Check a music operation without generating or spending credits. Omit id to list audio operations and recover completed downloads into the library. Never regenerate an uncertain operation automatically.",
      name: MUSIC_STATUS,
      shape: { id: z.string().min(1).optional() },
    },
    {
      description:
        "Generate sound effects only when the person asks for them. List connections first and use the chosen OpenRouter or ElevenLabs connection ID. Plan each cue from the actual scene action and timing; describe its texture and keep it below narration. OpenRouter requires Seed to be enabled and its provider terms accepted in the account settings. OpenRouter uses Seed Audio 1.0, accepts up to 3,000 characters including duration direction, and requests duration through the prompt. Use the default format for OpenRouter. Put every sound the person wants in `sounds` and make one call: the studio shows all of them on one card, with exact parameters, and asks before spending credits; the person may approve all or some. Do not split sounds into separate calls. It saves audio to the library without editing the project, and answers with the outcome of each sound. Never repeat an uncertain or declined generation: use sound_effect_status with its operation ID instead. Each new generation spends credits and requires new approval.",
      name: GENERATE_SOUND,
      shape: {
        connectionId: z.string().min(1),
        sounds: z
          .array(
            z.object({
              durationSeconds: z
                .number()
                .min(0.5)
                .max(30)
                .nullable()
                .default(null),
              format: z.enum(SOUND_FORMATS).default("mp3_44100_128"),
              name: z.string().trim().min(1).max(5000),
              text: z.string().trim().min(1).max(5000),
            })
          )
          .min(1)
          .max(10)
          .describe(
            "Every sound effect the person asked for, in one list, so they are approved on one card."
          ),
      },
    },
    {
      description:
        "Check an existing sound operation without generating or spending credits. Recover a completed download into the library if needed. Omit id to list operations and recover completed sounds after a lost response. Never automatically regenerate an uncertain operation.",
      name: SOUND_STATUS,
      shape: { id: z.string().min(1).optional() },
    },
    {
      description:
        "List the outside services this studio is connected to and what each one may be used for. Answers only with connections the person has checked and left enabled; a service that is not listed cannot be reached, and the person connects one in Settings under Integrations. Carries no keys or tokens.",
      name: LIST_CONNECTIONS,
      shape: {},
    },
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
    {
      description:
        "Search stock photography and footage on Pexels. Use it to curate visual references — for a moodboard, or when the person asks for stock media. It answers with items whose download URL and attribution you pass on; the network and the API key stay in the studio.",
      name: SEARCH_STOCK,
      shape: {
        kind: z
          .enum(["photo", "video"])
          .optional()
          .describe("What to search; photos when left out."),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("The result page, starting at 1."),
        query: z
          .string()
          .min(1)
          .describe(
            "What to look for — light, atmosphere and subject beat generic words: 'warm window light workspace', not 'office'."
          ),
      },
    },
    {
      description:
        "Answer with this project's moodboard when one exists: its spec and the path of its rendered PNG. Call it before generating anything — an existing board is worked from, never regenerated unless the person explicitly asks to start over. Edits go through save_moodboard as a change to the spec, replacing only the block that is off.",
      name: GET_MOODBOARD,
      shape: {},
    },
    {
      description:
        "Save this project's moodboard: the studio downloads the chosen images, writes the spec and renders the board to a PNG, storing it all as one library asset. Curate first — pick 5–8 photos from search_stock whose light and mood agree, extract the palette from those photos rather than inventing it, and pick Google Fonts the project could really use. It replaces the project's existing board, which is how a single block gets fixed: pass the spec again with only that block changed. After saving, read the returned PNG and judge it — a board whose one dark photo breaks the row is a board to iterate on.",
      name: SAVE_MOODBOARD,
      shape: {
        images: z
          .array(
            z
              .object({
                author: z
                  .string()
                  .optional()
                  .describe("The photographer, from the search result."),
                authorUrl: z.string().optional(),
                columns: z
                  .number()
                  .int()
                  .min(1)
                  .max(4)
                  .optional()
                  .describe(
                    "Grid columns this image spans, 1–4; the anchor photo is the wide one."
                  ),
                file: z
                  .string()
                  .optional()
                  .describe(
                    "A local image path — a project still or a file already on disk. Give this or url, not both."
                  ),
                id: z
                  .string()
                  .optional()
                  .describe("The stock item id, from the search result."),
                note: z
                  .string()
                  .optional()
                  .describe(
                    "A short caption saying what this reference is for."
                  ),
                pageUrl: z
                  .string()
                  .optional()
                  .describe("The stock item's page URL, for attribution."),
                role: z
                  .enum(["photo", "texture"])
                  .optional()
                  .describe(
                    "texture marks grain and backgrounds; photo when left out."
                  ),
                rows: z.number().int().min(1).max(4).optional(),
                url: z
                  .string()
                  .optional()
                  .describe("The download URL from search_stock."),
              })
              .refine(
                (image) =>
                  (image.file === undefined) !== (image.url === undefined),
                { message: "an image names exactly one of file or url" }
              )
          )
          .min(1)
          .max(12)
          .describe("The curated references, anchor first."),
        keywords: z
          .array(z.string().min(1))
          .max(6)
          .optional()
          .describe("Three to five tone words from the brief."),
        palette: z
          .array(
            z.object({
              hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "a swatch is #rrggbb"),
              name: z.string().optional(),
            })
          )
          .max(6)
          .optional()
          .describe(
            "Four to six swatches extracted from the chosen photos, not invented."
          ),
        title: z.string().min(1).describe("A short human name for the board."),
        typography: z
          .array(
            z.object({
              body: z.string().min(1).describe("A Google Fonts family."),
              heading: z.string().min(1).describe("A Google Fonts family."),
              sample: z
                .string()
                .optional()
                .describe("A line from the project to set the sample in."),
            })
          )
          .max(2)
          .optional()
          .describe("One or two font pairs."),
      },
    },
  ],
  [PIPELINE_SERVER]: [
    {
      description:
        "Start the seven-stage video production pipeline for this session: analysis, brand, script, motion, build, choreography, review. Call it once, when the person asks to create a video (or rework one from the ground up) and no pipeline is active yet. It answers with the instructions for the first stage — follow them.",
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
        reviewReportId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Required when marking review done. The full design_check report is reloaded against current sources; incomplete coverage, missing runtime motion contracts and unresolved measured errors keep the agent's review open. Human export stays available."
          ),
        stage: z.enum(PIPELINE_STAGE_IDS as unknown as [PipelineStageId]),
        status: z.enum(PIPELINE_STATUSES as unknown as [PipelineStatus]),
      },
    },
  ],
};
