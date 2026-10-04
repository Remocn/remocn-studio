import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { Effect } from "effect";
import type { PromptFrame, PromptParams } from "@/shared/ipc";
import type { Asset, AssetDraft } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import type { HistoryError } from "../history/store";
import {
  generateSounds,
  recoverSounds,
  type SoundContext,
  soundStatus,
} from "../integrations/sounds";
import { findMoodboard, saveMoodboard } from "../library/moodboard";
import { searchStock } from "../library/stock";
import {
  attachClip,
  attachPreview,
  listAssets,
  saveAsset,
} from "../library/store";
import { remotionRootOf } from "../preview/project";
import {
  clipFrom,
  designFrom,
  sourceFrom,
  stillFrom,
} from "../preview/supervisor";
import { VIDEOS_DIR } from "../scaffold/template";
import type { TurnTools } from "../tools/execute";
import { requestSourceAsset } from "./source";
import type { TurnContext } from "./turn";

const previewed = (projectId: string, playing: PromptFrame, asset: Asset) =>
  stillFrom(projectId, playing, () => undefined).pipe(
    Effect.flatMap((still) => attachPreview(asset.slug, still.path)),
    Effect.catch(() => Effect.succeed(asset))
  );

// Best-effort in the same sense the still is: a host busy with an export
// answers "no clip now" and the save is untouched. No backfill exists on
// purpose — a clip taken later would film today's composition, not the
// component that was saved.
const clipped = (projectId: string, playing: PromptFrame, asset: Asset) =>
  asset.type === "component"
    ? clipFrom(projectId, playing).pipe(
        Effect.flatMap((path) => attachClip(asset.slug, path)),
        Effect.catch(() => Effect.succeed(asset))
      )
    : Effect.succeed(asset);

const librarian = (params: PromptParams) => {
  const { playing, projectId } = params;

  return {
    list: () => Effect.runPromise(listAssets()),
    save: (draft: AssetDraft) =>
      Effect.runPromise(
        saveAsset(draft).pipe(
          Effect.flatMap((asset) =>
            playing === null
              ? Effect.succeed(asset)
              : previewed(projectId, playing, asset).pipe(
                  Effect.flatMap((saved) => clipped(projectId, playing, saved))
                )
          )
        )
      ),
  };
};

export function turnTools(
  turn: TurnContext,
  { ask }: { readonly ask: SoundContext["ask"] }
): TurnTools {
  const { brief, emit, params, permissions, project, store, turnId, video } =
    turn;

  // The agent moves the pipeline through its own MCP tools, so the webview
  // has no other way to hear about it: the stages ride on the turn's stream
  // the way the session row does, or the dock would only catch up when the
  // turn ends and someone refetched.
  const moved = (
    moving: Effect.Effect<readonly PipelineStage[], HistoryError>
  ) =>
    Effect.runPromise(
      moving.pipe(
        Effect.tap((rows) => emit({ stages: rows, type: "pipeline" }))
      )
    );

  return {
    connections: {
      usable: () => Effect.runPromise(ask("integrations.usable", null)),
    },
    cwd: project.path,
    design: {
      check: (
        { frames, motion, mode, options, reportId, video: sceneMap },
        execution
      ) =>
        Effect.runPromise(
          designFrom(
            params.projectId,
            {
              composition: video,
              ...(reportId === undefined ? {} : { reportId }),
              ...(mode === undefined ? {} : { mode }),
              ...(options === undefined ? {} : { options }),
              frames,
              motion,
              video: sceneMap,
            },
            execution?.progress
          ),
          { signal: execution?.signal }
        ),
      sources: () => videoSources(project.path, video),
    },
    library: librarian(params),
    moodboard: {
      find: () => Effect.runPromise(findMoodboard(params.projectId)),
      save: (draft) =>
        Effect.runPromise(
          saveMoodboard({ ...draft, project: params.projectId }, (input) =>
            sourceFrom(params.projectId, input)
          )
        ),
    },
    pipeline: {
      brief,
      requestSource: (input) =>
        Effect.runPromise(
          requestSourceAsset(
            {
              ...input,
              projectId: params.projectId,
              projectPath: project.path,
              turnId,
            },
            emit
          )
        ),
      setStage: (stage, status) =>
        moved(store.setStage(params.historyId, stage, status)),
      start: () => moved(store.startPipeline(params.historyId)),
    },
    sounds: {
      generate: (requests, execution) =>
        Effect.runPromise(
          generateSounds(requests, { ask, emit, permissions }),
          {
            signal: execution?.signal,
          }
        ),
      status: (id) =>
        Effect.runPromise(
          id === undefined
            ? recoverSounds(ask, (message) =>
                emit({ message, type: "notice" })
              ).pipe(
                Effect.andThen(ask("sounds.recover", null)),
                Effect.map((operations) =>
                  JSON.stringify(
                    operations.map(({ file: _file, ...operation }) => operation)
                  )
                )
              )
            : soundStatus(ask, id, emit)
        ),
    },
    stock: {
      search: (query) => Effect.runPromise(searchStock(query)),
    },
  };
}

const SOURCE_FILE = /\.(tsx|ts|jsx|js)$/;

// The turn's own video, and only it: the tunability check must never report on
// a folder somebody else's chat is working in. A video the turn could not name
// yields nothing rather than the whole project.
async function videoSources(
  path: string,
  slug: string | null
): Promise<readonly { path: string; source: string }[]> {
  if (slug === null) {
    return [];
  }

  const root = join(remotionRootOf(path), "src", VIDEOS_DIR, slug);

  try {
    const entries = await readdir(root, {
      recursive: true,
      withFileTypes: true,
    });

    const files = entries.filter(
      (entry) =>
        entry.isFile() &&
        (SOURCE_FILE.test(entry.name) ||
          (entry.name === "studio.json" && entry.parentPath === root))
    );

    return await Promise.all(
      files.map(async (entry) => {
        const file = join(entry.parentPath, entry.name);

        return {
          path: relative(root, file),
          source: await readFile(file, "utf8"),
        };
      })
    );
  } catch {
    return [];
  }
}
