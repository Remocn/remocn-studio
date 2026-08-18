import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Clock, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  type Project,
  type PromptFrame,
  type PromptParams,
  type SessionMode,
  SIDECAR_PROTOCOL,
} from "@/shared/ipc";
import type { Asset, AssetDraft } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import { AGENT_PROVIDERS } from "@/shared/providers";
import { makeAccountCache } from "./agent/account";
import { makeGate } from "./agent/gate";
import { makeModeSwitch } from "./agent/mode";
import { adapterFor } from "./agent/registry";
import { pipelineBrief } from "./claude/conventions";
import { checksFor } from "./environment";
import { type FilesError, listFolder, projectFiles } from "./files";
import { ProjectStore } from "./history/projects";
import { recording } from "./history/recorder";
import { type HistoryError, HistoryStore } from "./history/store";
import { HandlerError, type Handlers } from "./host";
import { listBundled } from "./library/bundled";
import {
  assetBrief,
  mediaBrief,
  placeAssets,
  placeMedia,
} from "./library/insert";
import {
  attachClip,
  attachPreview,
  attachProxy,
  dismissPaths,
  type LibraryError,
  listAssets,
  removeAsset,
  renameAsset,
  saveAsset,
  unofferedFrom,
} from "./library/store";
import { remotionRootOf } from "./preview/project";
import {
  clipFrom,
  exportFrom,
  previewEvents,
  stillFrom,
  warmFrom,
} from "./preview/supervisor";
import { installDependencies } from "./scaffold/install";
import { expandTemplate, type ScaffoldError } from "./scaffold/template";
import { makeGateway } from "./tools/gateway";
import { LIBRARY_SERVER, PIPELINE_SERVER } from "./tools/specs";

const TOKENS = [
  "Streaming",
  "straight",
  "out",
  "of",
  "the",
  "bun",
  "sidecar",
  "—",
  "one",
  "frame",
  "at",
  "a",
  "time.",
];

const MAX_COUNT = 500;
const MAX_DELAY_MS = 2000;

const gate = makeGate();

const gateway = makeGateway((line) => process.stderr.write(`${line}\n`));

const account = Effect.runSync(makeAccountCache());

const unstored = (error: HistoryError) =>
  new HandlerError({ message: error.message });

const unscaffolded = (error: ScaffoldError) =>
  new HandlerError({ message: error.message });

const unlibraried = (error: LibraryError) =>
  new HandlerError({ message: error.message });

const unlisted = (error: FilesError) =>
  new HandlerError({ message: error.message });

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

const onDisk = (project: Project) =>
  project.missing
    ? Effect.fail(
        new HandlerError({
          message: `${project.name} is not on disk anymore — ${project.path} is gone`,
        })
      )
    : Effect.succeed(project);

const located = (projectId: string) =>
  Effect.flatMap(ProjectStore, (projects) => projects.find(projectId)).pipe(
    Effect.mapError(unstored),
    Effect.flatMap(onDisk)
  );

export const handlers: Handlers<HistoryStore | ProjectStore> = {
  // One row per provider, for the model picker to mark who is actually
  // reachable. The probes share project.check's cache, so a warm answer
  // costs nothing and Recheck refreshes both.
  "agent.accounts": ({ params }) =>
    (params?.force === true ? account.clear : Effect.void).pipe(
      Effect.andThen(
        Effect.forEach(AGENT_PROVIDERS, (provider) =>
          account.row(provider, process.cwd())
        )
      )
    ),

  "agent.permission": ({ params }) =>
    Effect.map(
      gate.answer(params.id, params.decision, params.mode),
      (matched) => ({ matched })
    ),

  "agent.prompt": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const turnId = yield* Effect.sync(() => crypto.randomUUID());
      const project = yield* located(params.projectId);
      const adapter = adapterFor(params.provider);

      const store = yield* HistoryStore;
      const recorder = yield* recording(store, params, log);
      if (recorder.session !== null) {
        yield* emit({ session: recorder.session, type: "history" });
      }

      const copied = <A>(
        what: string,
        placing: Effect.Effect<readonly A[], LibraryError>
      ) =>
        placing.pipe(
          Effect.catch((error) =>
            log(`library: ${error.message}`).pipe(
              Effect.andThen(
                emit({
                  message: `The ${what} could not be copied into the project: ${error.message}`,
                  type: "notice",
                })
              ),
              Effect.as([] as readonly A[])
            )
          )
        );

      const placed = yield* copied(
        "referenced assets",
        placeAssets(project.path, params.assets)
      );
      const placedMedia = yield* copied(
        "attached media",
        placeMedia(project.path, params.media)
      );

      const switcher = yield* makeModeSwitch();

      const stages = yield* store
        .pipeline(params.historyId)
        .pipe(Effect.catch(() => Effect.succeed([])));

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

      const approved = (mode: SessionMode) =>
        switcher.set(mode).pipe(
          Effect.andThen(
            store.setMode(params.historyId, mode).pipe(
              Effect.flatMap((session) => emit({ session, type: "history" })),
              Effect.catch((error) => log(`history: ${error.message}`))
            )
          )
        );

      return yield* Effect.scoped(
        gateway
          .serving(turnId, {
            cwd: project.path,
            library: librarian(params),
            pipeline: {
              setStage: (stage, status) =>
                moved(store.setStage(params.historyId, stage, status)),
              start: () => moved(store.startPipeline(params.historyId)),
            },
          })
          .pipe(
            Effect.andThen(
              adapter.turn(params, {
                briefs: {
                  assets: assetBrief(placed),
                  media: mediaBrief(placedMedia),
                  pipeline: pipelineBrief(stages),
                },
                cwd: project.path,
                emit,
                gate,
                log,
                onApprove: approved,
                onMode: switcher.bind,
                record: recorder.event,
                tools: {
                  [LIBRARY_SERVER]: gateway.transport(LIBRARY_SERVER, turnId),
                  [PIPELINE_SERVER]: gateway.transport(PIPELINE_SERVER, turnId),
                },
                turnId,
              })
            )
          )
      );
    }),

  "files.list": ({ params }) =>
    listFolder(params.path).pipe(Effect.mapError(unlisted)),

  "history.blocks": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.blocks(params.sessionId)
    ).pipe(Effect.mapError(unstored)),

  "history.mode": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.setMode(params.sessionId, params.mode)
    ).pipe(Effect.mapError(unstored)),

  "history.remove": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.remove(params.sessionId)
    ).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "history.sessions": () =>
    Effect.flatMap(HistoryStore, (store) => store.sessions).pipe(
      Effect.mapError(unstored)
    ),

  "library.bundled": () => listBundled().pipe(Effect.mapError(unlibraried)),

  "library.dismiss": ({ params }) =>
    dismissPaths(params.attachments.map((item) => item.path)).pipe(
      Effect.map((dismissed) => ({ dismissed })),
      Effect.mapError(unlibraried)
    ),

  "library.list": () => listAssets().pipe(Effect.mapError(unlibraried)),

  "library.offer": ({ params }) =>
    unofferedFrom(params.attachments.map((item) => item.path)).pipe(
      Effect.map((paths) => {
        const kept = new Set(paths);
        return params.attachments.filter((item) => kept.has(item.path));
      }),
      Effect.mapError(unlibraried)
    ),

  "library.preview": ({ params }) =>
    attachPreview(params.slug, params.path).pipe(Effect.mapError(unlibraried)),

  "library.proxy": ({ params }) =>
    attachProxy(params.slug, params.path).pipe(Effect.mapError(unlibraried)),

  "library.remove": ({ params }) =>
    removeAsset(params.slug).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unlibraried)
    ),

  "library.rename": ({ params }) =>
    renameAsset(params.slug, params.name).pipe(Effect.mapError(unlibraried)),

  "library.save": ({ params }) =>
    saveAsset(params).pipe(Effect.mapError(unlibraried)),

  "pipeline.get": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.pipeline(params.sessionId)
    ).pipe(
      Effect.map((stages) => ({ sessionId: params.sessionId, stages })),
      Effect.mapError(unstored)
    ),

  "pipeline.set": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.setStage(params.sessionId, params.stage, params.status)
    ).pipe(
      Effect.map((stages) => ({ sessionId: params.sessionId, stages })),
      Effect.mapError(unstored)
    ),

  "pipeline.start": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.startPipeline(params.sessionId)
    ).pipe(
      Effect.map((stages) => ({ sessionId: params.sessionId, stages })),
      Effect.mapError(unstored)
    ),

  "preview.export": ({ emit, params }) =>
    exportFrom(params.projectId, params.composition, (event) =>
      Effect.runSync(emit(event))
    ).pipe(
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),

  "preview.start": ({ emit, log, params }) =>
    Effect.flatMap(located(params.projectId), (project) =>
      Stream.runForEach(
        previewEvents(params.projectId, project.path, log),
        emit
      ).pipe(
        Effect.as({ reason: "the preview host stopped" }),
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      )
    ),

  "preview.still": ({ emit, params }) =>
    stillFrom(
      params.projectId,
      { composition: params.composition, frame: params.frame },
      (event) => Effect.runSync(emit(event))
    ).pipe(
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),

  "preview.warm": ({ params }) =>
    warmFrom(params.projectId, params.composition).pipe(
      Effect.as({ warmed: true }),
      Effect.catch(() => Effect.succeed({ warmed: false }))
    ),

  "project.check": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      if (params.force) {
        yield* account.clear;
      }

      return {
        checks: yield* checksFor(
          project.path,
          yield* account.row(params.provider, project.path)
        ),
      };
    }),

  "project.create": ({ params }) =>
    Effect.gen(function* () {
      const projects = yield* ProjectStore;
      const path = join(params.parent, params.name);

      yield* Effect.tryPromise({
        catch: (cause) => new HandlerError({ message: errorMessage(cause) }),
        try: () => mkdir(path, { recursive: true }),
      });

      return yield* Effect.mapError(projects.open(path), unstored);
    }),

  "project.files": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      return yield* Effect.mapError(
        projectFiles(remotionRootOf(project.path)),
        unlisted
      );
    }),

  "project.install": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      yield* Effect.mapError(
        installDependencies(project.path, (line) =>
          Effect.andThen(
            log(`install: ${line}`),
            emit({ line, type: "output" })
          )
        ),
        unscaffolded
      );

      return { installed: true };
    }),

  "project.list": () =>
    Effect.flatMap(ProjectStore, (projects) => projects.list).pipe(
      Effect.mapError(unstored)
    ),

  "project.open": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) => projects.open(params.path)).pipe(
      Effect.mapError(unstored)
    ),

  "project.relocate": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.relocate(params.projectId, params.path)
    ).pipe(Effect.mapError(unstored)),

  "project.remove": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.remove(params.projectId)
    ).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "project.rename": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.rename(params.projectId, params.name)
    ).pipe(Effect.mapError(unstored)),

  "project.scaffold": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      yield* emit({ step: "template", type: "started" });
      yield* Effect.mapError(
        expandTemplate(project.path, {
          height: params.height,
          width: params.width,
        }),
        unscaffolded
      );
      yield* emit({ step: "template", type: "done" });

      yield* emit({ step: "install", type: "started" });
      yield* Effect.mapError(
        installDependencies(project.path, (line) => log(`install: ${line}`)),
        unscaffolded
      );
      yield* emit({ step: "install", type: "done" });

      return project;
    }),

  "sidecar.emit": ({ emit, params }) =>
    Effect.gen(function* () {
      const total = clamp(params.count, 1, MAX_COUNT);
      const delayMs = clamp(params.delayMs, 0, MAX_DELAY_MS);
      const startedAt = yield* Clock.currentTimeMillis;

      yield* Effect.forEach(
        Array.from({ length: total }, (_unused, index) => index),
        (index) =>
          Effect.sleep(delayMs).pipe(
            Effect.andThen(
              emit({ index, token: TOKENS[index % TOKENS.length], total })
            )
          ),
        { discard: true }
      );

      const finishedAt = yield* Clock.currentTimeMillis;

      return { elapsedMs: finishedAt - startedAt, emitted: total };
    }),

  "sidecar.info": () =>
    Effect.sync(() => ({
      bun: (process.versions as Record<string, string | undefined>).bun ?? "",
      cwd: process.cwd(),
      pid: process.pid,
      protocol: SIDECAR_PROTOCOL,
      uptimeMs: Math.round(process.uptime() * 1000),
    })),
};

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(Math.trunc(value), low), high);
}
