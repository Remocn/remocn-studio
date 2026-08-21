import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { errorMessage } from "@/lib/error-message";
import type { Asset, AssetDraft } from "@/shared/library";
import { assetTypeFor } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";
import type {
  PipelineStage,
  PipelineStageId,
  PipelineStatus,
} from "@/shared/pipeline";
import { pipelineBrief } from "../claude/conventions";
import type { DesignResult, MotionAssertion } from "../preview/design";
import {
  DESIGN_CHECK,
  DESIGN_SERVER,
  LIBRARY_SERVER,
  LIST_ASSETS,
  PIPELINE_SERVER,
  REQUEST_SOURCE_ASSET,
  SAVE_ASSET,
  START_PIPELINE,
  TOOL_SPECS,
  type ToolServer,
} from "./specs";

export interface LibraryCalls {
  readonly list: () => Promise<readonly Asset[]>;
  readonly save: (draft: AssetDraft) => Promise<Asset>;
}

export interface PipelineCalls {
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

export interface DesignCalls {
  readonly check: (input: {
    readonly frames: readonly number[];
    readonly motion: readonly MotionAssertion[];
  }) => Promise<DesignResult>;
}

export interface TurnTools {
  readonly cwd: string;
  readonly design: DesignCalls;
  readonly library: LibraryCalls;
  readonly pipeline: PipelineCalls;
}

export interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}

export function executeTool(
  server: ToolServer,
  tool: string,
  params: unknown,
  tools: TurnTools
): Promise<ToolAnswer> {
  return answer(() => {
    const spec = TOOL_SPECS[server].find((row) => row.name === tool);
    if (spec === undefined) {
      throw new Error(`${server} has no tool called ${tool}`);
    }

    const args = z.object(spec.shape).parse(params ?? {});
    return run(server, tool, args, tools);
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
  if (server === LIBRARY_SERVER && tool === SAVE_ASSET) {
    return saveAsset(args, tools);
  }
  if (server === PIPELINE_SERVER && tool === START_PIPELINE) {
    return staged(tools.pipeline.start());
  }
  if (server === PIPELINE_SERVER && tool === REQUEST_SOURCE_ASSET) {
    return requestSource(args, tools.pipeline);
  }
  if (server === DESIGN_SERVER && tool === DESIGN_CHECK) {
    return designCheck(args, tools.design);
  }
  return staged(
    tools.pipeline.setStage(
      args.stage as PipelineStageId,
      args.status as PipelineStatus
    )
  );
}

async function requestSource(
  args: Record<string, unknown>,
  pipeline: PipelineCalls
): Promise<string> {
  const result = await pipeline.requestSource(
    args as { attempt: string; name: string; source: string }
  );
  return JSON.stringify(result, null, 2);
}

async function designCheck(
  args: Record<string, unknown>,
  design: DesignCalls
): Promise<string> {
  const result = await design.check({
    frames: args.frames as number[],
    motion: (args.motion as MotionAssertion[] | undefined) ?? [],
  });
  return JSON.stringify(result, null, 2);
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
    dependencies: named.dependencies ?? [],
    description: named.description ?? "",
    duration: null,
    files,
    name: named.name,
    preview: null,
    role: named.role ?? null,
    type: named.type ?? assetTypeFor(files),
  });

  return `Saved ${saved.name} to the library as ${saved.slug} (${saved.type}), holding ${saved.files.length} file${saved.files.length === 1 ? "" : "s"}. It is now available in every project.`;
}

async function staged(
  moving: Promise<readonly PipelineStage[]>
): Promise<string> {
  const stages = await moving;
  const brief = pipelineBrief(stages);

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
