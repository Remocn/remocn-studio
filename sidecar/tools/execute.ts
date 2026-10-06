import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { errorMessage } from "@/lib/error-message";
import type { Asset, AssetDraft, StockPage } from "@/shared/library";
import { assetTypeFor } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";
import type {
  PipelineStage,
  PipelineStageId,
  PipelineStatus,
} from "@/shared/pipeline";
import { type ConnectionCalls, listConnections } from "../integrations/tools";
import type { MoodboardDraft, MoodboardRecord } from "../library/moodboard";
import { moodboardBrief } from "../library/moodboard";
import type { VideoCheck } from "../preview/choreography";
import type {
  DesignFinding,
  DesignResult,
  MotionAssertion,
} from "../preview/design";
import { makeFinding } from "../preview/readiness-analysis";
import type { ReadinessOptions } from "../preview/readiness-contract";
import { reviewCompletionProblem } from "./review";
import {
  DESIGN_CHECK,
  DESIGN_SERVER,
  GENERATE_MUSIC,
  GENERATE_SOUND,
  GET_MOODBOARD,
  LIBRARY_SERVER,
  LIST_ASSETS,
  LIST_CONNECTIONS,
  MUSIC_STATUS,
  PIPELINE_SERVER,
  REQUEST_SOURCE_ASSET,
  SAVE_ASSET,
  SAVE_MOODBOARD,
  SEARCH_STOCK,
  SOUND_STATUS,
  START_PIPELINE,
  TOOL_SPECS,
  type ToolServer,
} from "./specs";
import { tunabilityDesignFindings, tunabilityFindings } from "./tunability";

export interface LibraryCalls {
  readonly list: () => Promise<readonly Asset[]>;
  readonly save: (draft: AssetDraft) => Promise<Asset>;
}

export interface StockCalls {
  readonly search: (query: {
    readonly kind: "photo" | "video";
    readonly page: number;
    readonly query: string;
  }) => Promise<StockPage>;
}

export interface MoodboardCalls {
  readonly find: () => Promise<MoodboardRecord | null>;
  readonly save: (
    draft: Omit<MoodboardDraft, "project">
  ) => Promise<MoodboardRecord>;
}

export interface PipelineCalls {
  readonly brief: (stages: readonly PipelineStage[]) => string | null;
  readonly requestSource: (input: {
    readonly attempt: string;
    readonly name: string;
    readonly source: string;
  }) => Promise<import("@/shared/ipc").SourceAssetResolution>;
  readonly setStage: (
    stage: PipelineStageId,
    status: PipelineStatus
  ) => Promise<readonly PipelineStage[]>;
  readonly start: () => Promise<readonly PipelineStage[]>;
}

export interface ToolExecution {
  progress?: (stage: string, completed: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DesignCalls {
  readonly check: (
    input: {
      readonly reportId?: string;
      readonly mode?: "full" | "sampled" | "report";
      readonly options?: ReadinessOptions;
      readonly frames: readonly number[];
      readonly motion: readonly MotionAssertion[];
      readonly video: VideoCheck | null;
    },
    execution?: ToolExecution
  ) => Promise<DesignResult>;
  // The video's own source, so the check can answer what a rendered frame
  // never can: whether the person will be able to edit this motion.
  readonly sources: () => Promise<
    readonly { readonly path: string; readonly source: string }[]
  >;
}

export interface TurnTools {
  readonly connections: ConnectionCalls;
  readonly cwd: string;
  readonly design: DesignCalls;
  readonly library: LibraryCalls;
  readonly moodboard: MoodboardCalls;
  readonly pipeline: PipelineCalls;
  readonly sounds?: {
    generate: (
      requests: readonly import("@/shared/sound-effects").AudioRequest[],
      execution?: ToolExecution
    ) => Promise<string>;
    status: (id?: string) => Promise<string>;
  };
  readonly stock: StockCalls;
}

export interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}

export type Ask = (
  tool: string,
  params: unknown,
  execution?: ToolExecution
) => Promise<ToolAnswer>;

export function executeTool(
  server: ToolServer,
  tool: string,
  params: unknown,
  tools: TurnTools,
  execution?: ToolExecution
): Promise<ToolAnswer> {
  return answer(() => {
    const spec = TOOL_SPECS[server].find((row) => row.name === tool);
    if (spec === undefined) {
      throw new Error(`${server} has no tool called ${tool}`);
    }

    const args = z.object(spec.shape).parse(params ?? {});
    if (
      server === LIBRARY_SERVER &&
      (tool === GENERATE_SOUND ||
        tool === GENERATE_MUSIC ||
        tool === SOUND_STATUS ||
        tool === MUSIC_STATUS)
    ) {
      if (tools.sounds === undefined) {
        throw new Error("Sound generation is not available in this turn.");
      }
      if (tool === GENERATE_MUSIC) {
        return tools.sounds.generate(
          [
            {
              ...args,
              kind: "music",
            } as import("@/shared/sound-effects").MusicRequest,
          ],
          execution
        );
      }
      return tool === GENERATE_SOUND
        ? tools.sounds.generate(
            (args.sounds as Record<string, unknown>[]).map(
              (sound) =>
                ({
                  ...sound,
                  connectionId: args.connectionId,
                }) as import("@/shared/sound-effects").SoundRequest
            ),
            execution
          )
        : tools.sounds.status(args.id as string | undefined);
    }
    return run(server, tool, args, {
      ...tools,
      design: {
        ...tools.design,
        check: (input) => tools.design.check(input, execution),
      },
    });
  });
}

function run(
  server: ToolServer,
  tool: string,
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  if (server === LIBRARY_SERVER && tool === LIST_ASSETS) {
    return listAssets(tools.library);
  }
  if (server === LIBRARY_SERVER && tool === LIST_CONNECTIONS) {
    return listConnections(tools.connections);
  }
  if (server === LIBRARY_SERVER && tool === SAVE_ASSET) {
    return saveAsset(args, tools);
  }
  if (server === LIBRARY_SERVER && tool === SEARCH_STOCK) {
    return searchStock(args, tools.stock);
  }
  if (server === LIBRARY_SERVER && tool === GET_MOODBOARD) {
    return getMoodboard(tools.moodboard);
  }
  if (server === LIBRARY_SERVER && tool === SAVE_MOODBOARD) {
    return saveMoodboard(args, tools);
  }
  if (server === PIPELINE_SERVER && tool === START_PIPELINE) {
    return staged(tools.pipeline, tools.pipeline.start());
  }
  if (server === PIPELINE_SERVER && tool === REQUEST_SOURCE_ASSET) {
    return requestSource(args, tools.pipeline);
  }
  if (server === DESIGN_SERVER && tool === DESIGN_CHECK) {
    return designCheck(args, tools.design);
  }
  if (args.stage === "review" && args.status === "done") {
    return finishReview(args, tools);
  }
  return staged(
    tools.pipeline,
    tools.pipeline.setStage(
      args.stage as PipelineStageId,
      args.status as PipelineStatus
    )
  );
}

async function finishReview(
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  if (typeof args.reviewReportId !== "string") {
    throw new Error(
      "Pass reviewReportId from a full design_check when marking review done. Studio revalidates the report; a Markdown summary cannot complete the check."
    );
  }
  const result = await tools.design.check({
    frames: [],
    mode: "report",
    motion: [],
    reportId: args.reviewReportId,
    video: null,
  });
  const problem = reviewCompletionProblem(result.readiness);
  if (problem) {
    throw new Error(problem);
  }
  return staged(tools.pipeline, tools.pipeline.setStage("review", "done"));
}

async function requestSource(
  args: Record<string, unknown>,
  pipeline: PipelineCalls
): Promise<string> {
  const result = await pipeline.requestSource(
    args as { attempt: string; name: string; source: string }
  );
  return JSON.stringify(result);
}

async function designCheck(
  args: Record<string, unknown>,
  design: DesignCalls
): Promise<string> {
  if (
    args.mode !== "full" &&
    args.mode !== "report" &&
    !Array.isArray(args.frames)
  ) {
    throw new Error(
      "Sampled design_check requires 2–9 key frames; use mode=full for automatic coverage."
    );
  }
  const declared = args.video as
    | { camera?: string | null; scenes: VideoCheck["scenes"] }
    | undefined;
  const [result, sources] = await Promise.all([
    design.check({
      ...(typeof args.reportId === "string" ? { reportId: args.reportId } : {}),
      ...(args.mode === undefined
        ? {}
        : { mode: args.mode as "full" | "sampled" | "report" }),
      ...(args.options === undefined
        ? {}
        : { options: args.options as ReadinessOptions }),
      frames: (args.frames as number[] | undefined) ?? [],
      motion: (args.motion as MotionAssertion[] | undefined) ?? [],
      video:
        declared === undefined
          ? null
          : { camera: declared.camera ?? null, scenes: declared.scenes },
    }),
    design
      .sources()
      .then((files) => ({ error: null as string | null, files }))
      .catch((error) => ({ error: String(error), files: [] })),
  ]);

  const found = tunabilityDesignFindings(tunabilityFindings(sources.files));

  if (result.readiness) {
    const readiness = {
      ...result.readiness,
      checks: [
        ...result.readiness.checks,
        {
          reason:
            sources.error ??
            "Source editability checks are separate from exported viewer defects.",
          rule: "tunability",
          status: sources.error ? ("failed" as const) : ("completed" as const),
        },
      ],
      findings: [
        ...result.readiness.findings,
        ...found.map((row) =>
          makeFinding({
            ...row,
            audience: "tunability",
            category: "tunability",
            from: 0,
            to: result.readiness?.coverage.durationInFrames ?? 1,
          })
        ),
      ],
    };
    return JSON.stringify({ ...result, readiness });
  }
  const merged: DesignResult = {
    ...result,
    findings: [...result.findings, ...found],
    summary: {
      errors: result.summary.errors + counted(found, "error"),
      info: result.summary.info + counted(found, "info"),
      warnings: result.summary.warnings + counted(found, "warning"),
    },
  };

  return JSON.stringify(merged);
}

function counted(
  findings: readonly DesignFinding[],
  severity: DesignFinding["severity"]
): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

async function listAssets(library: LibraryCalls): Promise<string> {
  const assets = await library.list();

  if (assets.length === 0) {
    return "The library is empty.";
  }

  return assets.map(inventory).join("\n\n");
}

async function saveAsset(
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  const named = args as {
    dependencies?: string[];
    description?: string;
    files: string[];
    name: string;
    role?: MotionRole;
    type?: AssetDraft["type"];
  };

  const files = named.files.map((file) =>
    isAbsolute(file) ? file : resolve(tools.cwd, file)
  );

  const saved = await tools.library.save({
    audiomap: null,
    dependencies: named.dependencies ?? [],
    description: named.description ?? "",
    duration: null,
    files,
    name: named.name,
    preview: null,
    role: named.role ?? null,
    source: null,
    type: named.type ?? assetTypeFor(files),
  });

  return `Saved ${saved.name} to the library as ${saved.slug} (${saved.type}), holding ${saved.files.length} file${saved.files.length === 1 ? "" : "s"}. It is now available in every project.`;
}

async function searchStock(
  args: Record<string, unknown>,
  stock: StockCalls
): Promise<string> {
  const named = args as {
    kind?: "photo" | "video";
    page?: number;
    query: string;
  };

  const page = await stock.search({
    kind: named.kind ?? "photo",
    page: named.page ?? 1,
    query: named.query,
  });

  if (page.items.length === 0) {
    return `Pexels found nothing for "${named.query}" — try different words.`;
  }

  const items = page.items.map((item) => ({
    author: item.author,
    authorUrl: item.authorUrl,
    download: item.download,
    duration: item.duration,
    height: item.height,
    id: item.id,
    name: item.name,
    pageUrl: item.url,
    width: item.width,
  }));

  const tail =
    page.nextPage === null
      ? ""
      : `\n\nMore results exist — pass page: ${page.nextPage} for the next ones.`;

  return `${JSON.stringify(items)}${tail}`;
}

async function getMoodboard(moodboard: MoodboardCalls): Promise<string> {
  const record = await moodboard.find();

  if (record === null) {
    return "There is no moodboard for this project yet.";
  }

  return moodboardBrief(record);
}

function resolvedFile(cwd: string, file: string | undefined): string | null {
  if (file === undefined) {
    return null;
  }
  return isAbsolute(file) ? file : resolve(cwd, file);
}

async function saveMoodboard(
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  const named = args as {
    images: {
      author?: string;
      authorUrl?: string;
      columns?: number;
      file?: string;
      id?: string;
      note?: string;
      pageUrl?: string;
      role?: "photo" | "texture";
      rows?: number;
      url?: string;
    }[];
    keywords?: string[];
    palette?: { hex: string; name?: string }[];
    title: string;
    typography?: { body: string; heading: string; sample?: string }[];
  };

  const record = await tools.moodboard.save({
    images: named.images.map((image) => ({
      columns: image.columns ?? null,
      file: resolvedFile(tools.cwd, image.file),
      note: image.note ?? "",
      role: image.role ?? "photo",
      rows: image.rows ?? null,
      source:
        image.url !== undefined && image.id !== undefined
          ? {
              author: image.author ?? "",
              authorUrl: image.authorUrl ?? "",
              id: image.id,
              provider: "pexels" as const,
              url: image.pageUrl ?? "",
            }
          : null,
      url: image.url ?? null,
    })),
    keywords: named.keywords ?? [],
    palette: (named.palette ?? []).map((swatch) => ({
      hex: swatch.hex,
      name: swatch.name ?? "",
    })),
    title: named.title,
    typography: (named.typography ?? []).map((pair) => ({
      body: pair.body,
      heading: pair.heading,
      sample: pair.sample ?? "",
    })),
  });

  const looked =
    record.asset.preview === null
      ? "The board rendered no preview."
      : `The rendered board is at ${record.asset.preview} — read that file, judge it like a designer, and iterate by calling save_moodboard again with only the block that reads wrong replaced.`;

  return `Saved the moodboard ${record.asset.name} as ${record.asset.slug}, holding ${record.spec.images.length} image${record.spec.images.length === 1 ? "" : "s"}. ${looked}`;
}

async function staged(
  pipeline: PipelineCalls,
  moving: Promise<readonly PipelineStage[]>
): Promise<string> {
  const stages = await moving;
  const brief = pipeline.brief(stages);

  return `${JSON.stringify(stages)}${brief === null ? "" : `\n\n${brief}`}`;
}

function inventory(asset: Asset): string {
  const lines = [
    asset.role === null
      ? `${asset.name} — ${asset.type}`
      : `${asset.name} — ${asset.type}, ${asset.role}`,
  ];

  if (asset.description.length > 0) {
    lines.push(asset.description);
  }

  lines.push(`files: ${asset.files.join(", ")}`);

  if (asset.dependencies.length > 0) {
    lines.push(`needs: ${asset.dependencies.join(", ")}`);
  }

  return lines.join("\n");
}

async function answer(work: () => Promise<string>): Promise<ToolAnswer> {
  try {
    return { isError: false, text: await work() };
  } catch (cause) {
    return { isError: true, text: errorMessage(cause) };
  }
}
