import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Clock, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import { crashLine } from "@/shared/crash";
import {
  DATA_DIR_ENV,
  type Project,
  type PromptFrame,
  type PromptParams,
  type SessionMode,
  SIDECAR_PROTOCOL,
} from "@/shared/ipc";
import type { Asset, AssetDraft } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import { AGENT_PROVIDERS } from "@/shared/providers";
import { freeSlug, slugFor } from "@/shared/slug";
import { templateProjectName } from "@/shared/templates";
import { acpPool } from "./acp/pool";
import { makeAccountCache } from "./agent/account";
import { coalescing } from "./agent/coalesce";
import { makeGate } from "./agent/gate";
import { makeModeSwitch } from "./agent/mode";
import { adapterFor } from "./agent/registry";
import {
  abandonSourceAssets,
  answerSourceAsset,
  requestSourceAsset,
} from "./agent/source";
import { pipelineBrief } from "./claude/conventions";
import { escapee } from "./contained";
import { applyCrashConsent, isReporting } from "./crash";
import { readProjectDocument, videoDocuments } from "./documents";
import { projectChecks } from "./environment";
import { type FilesError, listFolder, projectFiles } from "./files";
import { openStudioProject, ProjectStore } from "./history/projects";
import { recording } from "./history/recorder";
import { type HistoryError, HistoryStore } from "./history/store";
import { VideoStore } from "./history/videos";
import { HandlerError, type Handlers } from "./host";
import {
  generateSounds,
  recoverSounds,
  soundStatus,
} from "./integrations/sounds";
import { listBundled } from "./library/bundled";
import {
  addCommandFor,
  assetBrief,
  mediaBrief,
  placeAssets,
  placeMedia,
} from "./library/insert";
import { findMoodboard, saveMoodboard } from "./library/moodboard";
import {
  type StockError,
  saveStock,
  searchStock,
  stockConfigured,
} from "./library/stock";
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
import { removals } from "./preview/removals";
import {
  clipFrom,
  designFrom,
  exportFrom,
  previewEvents,
  removeFrom,
  sourceFrom,
  statusFrom,
  stillFrom,
  stopProjectPreview,
  warmFrom,
  writeFrom,
} from "./preview/supervisor";
import {
  applicationBrief,
  confirmBrandApplication,
  finishBrandApplication,
  prepareBrandApplication,
  readBrandApplication,
} from "./projects/apply";
import {
  brandBrief,
  importBrandFile,
  snapshotOf,
  writeSnapshot,
} from "./projects/brand";
import { configEffect, getConfig, saveConfig } from "./projects/config";
import { importDesignMarkdown } from "./projects/design-import";
import { brandStarter } from "./projects/font-runtime";
import { googleFont } from "./projects/fonts";
import {
  cancelProjectMove,
  moveProjectFiles,
  prepareMove,
} from "./projects/move";
import {
  readStudioDocument,
  removeStudioObject,
  writeStudioDocument,
} from "./projects/studio-document";
import {
  installDependencies,
  installScaffold,
  upgradeDependencies,
} from "./scaffold/install";
import { ensureRegistry } from "./scaffold/registry";
import {
  expandTemplate,
  expandVideo,
  type ScaffoldError,
  VIDEOS_DIR,
} from "./scaffold/template";
import {
  DEFAULT_PROJECTS_DIR,
  expandTemplateVideo,
  mintFolder,
} from "./scaffold/templates";
import { makeGateway } from "./tools/gateway";
import { TOOL_SERVERS } from "./tools/specs";

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

const STREAMED_FRAME = "24 millis";

const unstored = (error: { message: string }) =>
  new HandlerError({ message: error.message });

const unscaffolded = (error: ScaffoldError) =>
  new HandlerError({ message: error.message });

const unlibraried = (error: LibraryError) =>
  new HandlerError({ message: error.message });

const unstocked = (error: StockError) =>
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

const joinedBriefs = (...briefs: readonly (string | null)[]) => {
  const present = briefs.filter((brief): brief is string => brief !== null);
  return present.length === 0 ? null : present.join("\n\n");
};

const OUTSIDE_PROJECT =
  "this element is written outside the project folder, so the studio will not touch it";

const insideProject = (root: string, files: readonly string[]) =>
  Effect.flatMap(
    Effect.promise(() => escapee(root, [], files)),
    (escaped) =>
      escaped === null
        ? Effect.void
        : Effect.fail(
            new HandlerError({
              message: `${escaped} is outside the project folder, so the studio will not touch it.`,
            })
          )
  );

const resumingStored = (
  params: PromptParams,
  resumeId: string | null
): PromptParams =>
  params.sessionId === null && resumeId !== null
    ? { ...params, sessionId: resumeId }
    : params;

const located = (projectId: string) =>
  Effect.flatMap(ProjectStore, (projects) => projects.find(projectId)).pipe(
    Effect.mapError(unstored),
    Effect.flatMap(onDisk)
  );

export const handlers: Handlers<HistoryStore | ProjectStore | VideoStore> = {
  // One row per provider, for the model picker to mark who is actually
  // reachable. The probes share project.check's cache, so a warm answer
  // costs nothing and Recheck refreshes both.
  "agent.accounts": ({ params }) =>
    (params?.force === true ? account.clear : Effect.void).pipe(
      Effect.andThen(
        Effect.forEach(
          AGENT_PROVIDERS,
          (provider) => account.row(provider, process.cwd()),
          { concurrency: "unbounded" }
        )
      )
    ),

  "agent.permission": ({ params }) =>
    Effect.map(
      gate.answer(params.id, params.decision, params.mode),
      (matched) => ({ matched })
    ),

  "agent.prompt": ({ ask, emit: send, log, params }) =>
    Effect.gen(function* () {
      const { emit, flush } = yield* coalescing(send, STREAMED_FRAME);
      yield* Effect.addFinalizer(() => flush);
      const turnId = yield* Effect.sync(() => crypto.randomUUID());
      const project = yield* located(params.projectId);
      const adapter = adapterFor(params.provider);
      const toolKey =
        adapter.persistent === true ? `chat-${params.historyId}` : turnId;

      const store = yield* HistoryStore;
      const videos = yield* VideoStore;
      const videoRow = yield* Effect.mapError(
        videos.find(params.videoId),
        unstored
      );
      if (videoRow.projectId !== project.id) {
        return yield* Effect.fail(
          new HandlerError({
            message: "This video does not belong to the selected project.",
          })
        );
      }
      const video = videoRow.compositionId;
      const config = yield* configEffect(() => getConfig(project)).pipe(
        Effect.mapError(unstored)
      );
      if (
        params.brandRevision !== undefined &&
        params.brandRevision !== config.revision
      ) {
        return yield* Effect.fail(
          new HandlerError({
            message:
              "Project brand changed. Reload settings before applying it.",
          })
        );
      }
      const application =
        params.brandRevision === undefined
          ? null
          : yield* configEffect(() =>
              prepareBrandApplication(
                project.path,
                video,
                config,
                params.historyId
              )
            ).pipe(Effect.mapError(unstored));
      const brand =
        application === null
          ? yield* configEffect(() =>
              brandBrief(project.path, project.id, video)
            ).pipe(Effect.mapError(unstored))
          : applicationBrief(application);

      const recorder = yield* recording(store, params, log);
      const resumeId = recorder.session?.sdkSessionId ?? null;
      let turnParams = resumingStored(params, resumeId);
      if (
        params.sessionId !== null &&
        recorder.session !== null &&
        resumeId === null
      ) {
        const previous = yield* store
          .blocks(params.historyId)
          .pipe(Effect.mapError(unstored));
        turnParams = {
          ...params,
          prompt: `${params.prompt}\n\nPrevious Studio conversation (historical user data; paths may refer to the former location):\n${JSON.stringify(previous).slice(-24_000)}`,
          sessionId: null,
        };
        yield* emit({
          message:
            "Starting a new provider session in the current project folder. Studio history is preserved.",
          type: "notice",
        });
      }
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
        placeMedia(project.path, video, params.media)
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

      const result = yield* Effect.scoped(
        gateway
          .serving(toolKey, {
            connections: {
              usable: () => Effect.runPromise(ask("integrations.usable", null)),
            },
            cwd: project.path,
            design: {
              check: (
                { frames, motion, mode, options, reportId, video: sceneMap },
                execution
              ) =>
                video === null
                  ? Promise.reject(
                      new Error(
                        "This chat has no video to check: it is not attached to a composition."
                      )
                    )
                  : Effect.runPromise(
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
                  saveMoodboard(
                    { ...draft, project: params.projectId },
                    (input) => sourceFrom(params.projectId, input)
                  )
                ),
            },
            pipeline: {
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
                  generateSounds(requests, { ask, emit, gate, turnId }),
                  { signal: execution?.signal }
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
                            operations.map(
                              ({ file: _file, ...operation }) => operation
                            )
                          )
                        )
                      )
                    : soundStatus(ask, id, emit)
                ),
            },
            stock: {
              search: (query) => Effect.runPromise(searchStock(query)),
            },
          })
          .pipe(
            Effect.andThen(
              adapter.turn(turnParams, {
                briefs: {
                  assets: assetBrief(placed, addCommandFor(project.path)),
                  brand,
                  media: joinedBriefs(
                    mediaBrief(placedMedia),
                    removals.brief(project.path)
                  ),
                  pipeline: pipelineBrief(stages, video),
                },
                cwd: project.path,
                emit,
                gate,
                inProcess: Object.fromEntries(
                  TOOL_SERVERS.map((server) => [
                    server,
                    gateway.ask(server, toolKey),
                  ])
                ),
                log,
                onApprove: approved,
                onMode: switcher.bind,
                record: recorder.event,
                tools: Object.fromEntries(
                  TOOL_SERVERS.map((server) => [
                    server,
                    gateway.transport(server, toolKey),
                  ])
                ),
                turnId,
                video,
              })
            )
          )
      ).pipe(
        Effect.ensuring(recorder.flush),
        Effect.ensuring(abandonSourceAssets(turnId)),
        Effect.onInterrupt(() =>
          application === null
            ? Effect.void
            : configEffect(() =>
                finishBrandApplication(project.path, video, application, false)
              ).pipe(Effect.ignore)
        )
      );
      if (application !== null) {
        yield* configEffect(() =>
          finishBrandApplication(
            project.path,
            video,
            application,
            result.failure === null
          )
        ).pipe(Effect.mapError(unstored));
      }
      return result;
    }).pipe(Effect.scoped),

  "agent.source": ({ params }) =>
    answerSourceAsset(params).pipe(
      Effect.map((matched) => ({ matched })),
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),

  // The live half of the consent. Rust already read `settings.json` at spawn;
  // this is what makes the switch bite now rather than at the next launch,
  // and it answers what the sidecar is *actually* doing — a build with no DSN
  // reports nothing however the switch is set.
  "crash.consent": ({ log, params }) =>
    Effect.flatMap(applyCrashConsent(params.enabled), (outcome) =>
      log(crashLine(outcome)).pipe(Effect.as({ reporting: isReporting() }))
    ),

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

  // A message that only wrote values into the code starts no turn, and it still
  // has to be in the transcript: this is `agent.prompt`'s first two steps and
  // nothing else — open the session, write the user entry, answer with the row.
  "history.record": ({ log, params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      Effect.map(recording(store, params, log), (recorder) => ({
        session: recorder.session,
      }))
    ),

  "history.remove": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.remove(params.sessionId)
    ).pipe(
      Effect.tap(() => acpPool.dispose(params.sessionId)),
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

  "library.list": ({ ask, log }) =>
    recoverSounds(ask, log).pipe(
      Effect.andThen(listAssets()),
      Effect.mapError(unlibraried)
    ),

  "library.offer": ({ params }) =>
    unofferedFrom(params.attachments.map((item) => item.path)).pipe(
      Effect.map((paths) => {
        const kept = new Set(paths);
        return params.attachments.filter((item) => kept.has(item.path));
      }),
      Effect.mapError(unlibraried)
    ),

  "library.preview": ({ params }) =>
    attachPreview(
      params.slug,
      params.path,
      params.duration,
      params.audiomap
    ).pipe(Effect.mapError(unlibraried)),

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

  "library.stockSave": ({ emit, params }) =>
    saveStock(params, (progress) => Effect.runSync(emit(progress))).pipe(
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),

  "library.stockSearch": ({ params }) =>
    searchStock(params).pipe(Effect.mapError(unstocked)),

  "library.stockStatus": () =>
    stockConfigured().pipe(
      Effect.map((configured) => ({ configured })),
      Effect.mapError(unstocked)
    ),

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
    exportFrom(
      params.projectId,
      {
        composition: params.composition,
        format: params.format,
        outputPath: params.outputPath,
        preset: params.preset,
        quality: params.quality,
        resolution: params.resolution,
      },
      (event) => Effect.runSync(emit(event))
    ).pipe(
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),
  "preview.remove": ({ log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      yield* insideProject(project.path, [params.target.file]);
      const removed = yield* removeFrom(
        params.projectId,
        params.component,
        params.target,
        params.video
      ).pipe(
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      );
      const written = yield* removals
        .commit(project.path, removed, params.component)
        .pipe(
          Effect.mapError(
            (error) => new HandlerError({ message: error.message })
          )
        );
      yield* log(`removed an element from ${written.file}`);
      return written;
    }),
  "preview.restore": ({ log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      const restored = yield* removals
        .restore(project.path, params.removal)
        .pipe(
          Effect.mapError(
            (error) => new HandlerError({ message: error.message })
          )
        );
      yield* log(`restored an element in ${restored.file}`);
      return restored;
    }),

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

  // A target outside the project is dropped rather than failing the batch: a
  // chain routinely reaches a component the studio has no business writing to,
  // and the honest answer for that one link is "not from here", not silence
  // about the rest.
  "preview.status": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      const inside = yield* Effect.promise(() =>
        Promise.all(
          params.targets.map(async (target) => ({
            ok: (await escapee(project.path, [], [target.file])) === null,
            target,
          }))
        )
      );

      const asked = inside.filter((one) => one.ok).map((one) => one.target);

      const outside = inside
        .filter((one) => !one.ok)
        .map((one) => ({
          id: one.target.id,
          nodePath: null,
          props: {},
          reason: OUTSIDE_PROJECT,
        }));

      const answered =
        asked.length === 0
          ? []
          : yield* statusFrom(params.projectId, asked, params.video).pipe(
              Effect.mapError(
                (error) => new HandlerError({ message: error.message })
              )
            );

      return { targets: [...answered, ...outside] };
    }),

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
  // Two containment checks, not one: the first covers the files the host is
  // about to read, the second the paths it names in its answer. The host only
  // ever produces text — the write is here, where the project's boundary is
  // already the permission gate's own.
  "preview.write": ({ log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      yield* insideProject(
        project.path,
        params.edits.map((edit) => edit.file)
      );

      const built = yield* writeFrom(
        params.projectId,
        params.edits,
        params.partial
      ).pipe(
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      );

      yield* insideProject(
        project.path,
        built.files.map((file) => file.path)
      );

      yield* Effect.forEach(
        built.files,
        (file) =>
          Effect.tryPromise({
            catch: (cause) =>
              new HandlerError({
                message: `${file.path} could not be written: ${errorMessage(cause)}`,
              }),
            try: () => writeFile(file.path, file.contents, "utf8"),
          }),
        { discard: true }
      );

      yield* log(
        `wrote ${built.files.length} file(s) from ${params.edits.length} edit(s)`
      );

      return {
        files: built.files.map((file) => file.path),
        results: built.results,
      };
    }),
  "project.brandFile": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* configEffect(() =>
        importBrandFile(project.path, params.path)
      ).pipe(Effect.mapError(unstored));
    }),

  "project.check": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      if (params.force) {
        yield* account.clear;
      }

      const [row, rows] = yield* Effect.all(
        [
          account.row(params.provider, project.path),
          projectChecks(project.path),
        ],
        { concurrency: "unbounded" }
      );

      return { checks: [row, ...rows] };
    }),
  "project.create": ({ params }) =>
    Effect.gen(function* () {
      const projects = yield* ProjectStore;
      const path = join(params.parent, params.name);

      yield* Effect.tryPromise({
        catch: (cause) => new HandlerError({ message: errorMessage(cause) }),
        try: () => mkdir(path, { recursive: true }),
      });

      const project = yield* Effect.mapError(projects.open(path), unstored);
      yield* configEffect(() =>
        saveConfig(project, {
          brand: null,
          expectedRevision: 0,
          name: project.name,
          projectId: project.id,
        })
      ).pipe(Effect.mapError(unstored));
      return project;
    }),
  "project.designImport": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* configEffect(() =>
        importDesignMarkdown(project.path, params.path)
      ).pipe(Effect.mapError(unstored));
    }),

  "project.files": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      return yield* Effect.mapError(
        projectFiles(remotionRootOf(project.path)),
        unlisted
      );
    }),

  // A link opened the app with a template and its props: the project, its first
  // video and the props in that video's module are all written here, and the
  // webview then runs the ordinary scaffold for the install. Free or signed
  // out makes no difference — the template is not a Pro feature.
  "project.fromTemplate": ({ params }) =>
    Effect.gen(function* () {
      const projects = yield* ProjectStore;
      const videos = yield* VideoStore;
      const name = templateProjectName(params.template, params.props);

      const path = yield* Effect.tryPromise({
        catch: (cause) => new HandlerError({ message: errorMessage(cause) }),
        try: () => mintFolder(params.parent ?? DEFAULT_PROJECTS_DIR, name),
      });

      const project = yield* Effect.mapError(projects.open(path), unstored);
      const config = yield* configEffect(() =>
        saveConfig(project, {
          brand: null,
          expectedRevision: 0,
          name: project.name,
          projectId: project.id,
        })
      ).pipe(Effect.mapError(unstored));

      yield* Effect.mapError(expandTemplate(path), unscaffolded);
      yield* Effect.mapError(ensureRegistry(path), unscaffolded);
      const slug = yield* Effect.mapError(
        expandTemplateVideo(path, params.template, params.props),
        unscaffolded
      );

      const video = yield* Effect.mapError(
        videos.create({ compositionId: slug, name, projectId: project.id }),
        unstored
      );

      yield* configEffect(() =>
        writeSnapshot(project.path, slug, snapshotOf(config))
      ).pipe(Effect.mapError(unstored));
      return { project, video };
    }),
  "project.googleFont": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* configEffect(() =>
        googleFont(project.path, params.family, params.weights, params.italic)
      ).pipe(Effect.mapError(unstored));
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
  "project.move": ({ params, emit }) =>
    Effect.uninterruptible(
      Effect.gen(function* () {
        const project = yield* located(params.projectId);
        yield* configEffect(() =>
          prepareMove(project.path, params.parent)
        ).pipe(Effect.mapError(unstored));
        const config = yield* configEffect(() => getConfig(project)).pipe(
          Effect.mapError(unstored)
        );
        yield* configEffect(() =>
          saveConfig(project, {
            brand: config.brand,
            expectedRevision: config.revision,
            name: config.name,
            projectId: project.id,
          })
        ).pipe(Effect.mapError(unstored));
        const projects = yield* ProjectStore;
        yield* stopProjectPreview(project.id);
        yield* configEffect(() =>
          moveProjectFiles(
            project.id,
            project.path,
            params.parent,
            join(
              process.env[DATA_DIR_ENV] ?? join(tmpdir(), "remocn-studio"),
              "moves"
            ),
            (destination) =>
              Effect.runPromise(
                projects.relocate(project.id, destination)
              ).then(() => undefined),
            (phase) => {
              Effect.runSync(emit({ phase }));
            }
          )
        ).pipe(Effect.mapError(unstored));
        return yield* projects.find(project.id).pipe(Effect.mapError(unstored));
      })
    ),

  "project.moveCancel": ({ params }) =>
    Effect.sync(() => {
      cancelProjectMove(params.projectId);
      return null;
    }),

  "project.open": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      openStudioProject(projects, params.path)
    ).pipe(Effect.mapError(unstored)),

  // The pane never joins a path itself, and never reaches outside the folder
  // it was given: the read resolves symlinks and `..` and refuses anything
  // that lands outside the project, exactly as the permission gate does.
  "project.read": ({ params }) =>
    located(params.projectId).pipe(
      Effect.flatMap((project) =>
        Effect.mapError(
          readProjectDocument(project.path, params.path),
          unlisted
        )
      )
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
      yield* Effect.mapError(expandTemplate(project.path), unscaffolded);
      yield* Effect.mapError(ensureRegistry(project.path), unscaffolded);
      yield* emit({ step: "template", type: "done" });

      yield* emit({ step: "install", type: "started" });
      yield* Effect.mapError(
        installScaffold(project.path, (line) => log(`install: ${line}`)),
        unscaffolded
      );
      yield* emit({ step: "install", type: "done" });

      return project;
    }),
  "project.settingsGet": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* configEffect(() => getConfig(project)).pipe(
        Effect.mapError(unstored)
      );
    }),
  "project.settingsSave": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      const config = yield* configEffect(() =>
        saveConfig(project, params)
      ).pipe(Effect.mapError(unstored));
      const projects = yield* ProjectStore;
      yield* projects.find(project.id).pipe(Effect.mapError(unstored));
      return config;
    }),

  "project.upgrade": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      yield* Effect.mapError(
        upgradeDependencies(
          project.path,
          params.packages,
          params.version,
          (line) =>
            Effect.andThen(
              log(`upgrade: ${line}`),
              emit({ line, type: "output" })
            )
        ),
        unscaffolded
      );

      return { upgraded: true };
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
  "studio.patch": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* writeStudioDocument(
        project.path,
        params.video,
        params.operation
      ).pipe(
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      );
    }),

  "studio.read": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* readStudioDocument(project.path, params.video).pipe(
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      );
    }),
  "studio.remove": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      return yield* removeStudioObject(
        project.path,
        params.video,
        params.operation
      ).pipe(
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      );
    }),
  "video.brandConfirm": ({ params }) =>
    Effect.gen(function* () {
      const videos = yield* VideoStore;
      const video = yield* videos
        .find(params.videoId)
        .pipe(Effect.mapError(unstored));
      if (video.projectId !== params.projectId) {
        return yield* Effect.fail(
          new HandlerError({
            message: "This video belongs to another project.",
          })
        );
      }
      const project = yield* located(params.projectId);
      return yield* configEffect(() =>
        confirmBrandApplication(
          project.path,
          video.compositionId,
          project.id,
          params.revision
        )
      ).pipe(Effect.mapError(unstored));
    }),

  // The slug is minted here and never moves again; the name is the row's
  // and renames freely. Both halves of the video — the folder the scan
  // picks up and the row the pane draws — are written by this one call,
  // for the first video of a project and for every one after it.
  "video.brandStatus": ({ params }) =>
    Effect.gen(function* () {
      const videos = yield* VideoStore;
      const video = yield* videos
        .find(params.videoId)
        .pipe(Effect.mapError(unstored));
      const project = yield* located(video.projectId);
      return yield* configEffect(() =>
        readBrandApplication(project.path, video.compositionId)
      ).pipe(Effect.mapError(unstored));
    }),
  "video.create": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      const videos = yield* VideoStore;

      const taken = yield* Effect.mapError(
        videos.taken(params.projectId),
        unstored
      );

      const slug = freeSlug(slugFor(params.name), [
        ...taken,
        ...(yield* videoFolders(project.path)),
      ]);

      // A folder nothing registers is not a video. In a project the studio
      // scaffolded this is already true and costs a read; in one opened from
      // disk it is what makes the folder reach Remotion at all.
      yield* Effect.mapError(ensureRegistry(project.path), unscaffolded);

      yield* Effect.mapError(
        expandVideo(project.path, {
          name: params.name,
          size: { height: params.height, width: params.width },
          slug,
        }),
        unscaffolded
      );

      const config = yield* configEffect(() => getConfig(project)).pipe(
        Effect.mapError(unstored)
      );
      yield* configEffect(() =>
        writeSnapshot(project.path, slug, snapshotOf(config))
      ).pipe(Effect.mapError(unstored));
      yield* configEffect(() =>
        brandStarter(project.path, slug, snapshotOf(config))
      ).pipe(Effect.mapError(unstored));

      return yield* Effect.mapError(
        videos.create({
          compositionId: slug,
          name: params.name,
          projectId: params.projectId,
        }),
        unstored
      );
    }),

  // A video's stage documents, listed where the pipeline brief told the agent
  // to write them. A folder that does not exist yet answers with an empty
  // list and its own path, because "the pipeline has not run" is not a fault.
  "video.documents": ({ params }) =>
    Effect.gen(function* () {
      const videos = yield* VideoStore;
      const video = yield* Effect.mapError(
        videos.find(params.videoId),
        unstored
      );
      const project = yield* located(video.projectId);

      return yield* Effect.mapError(
        videoDocuments(project.path, video.compositionId),
        unlisted
      );
    }),

  "video.list": ({ params }) =>
    Effect.flatMap(VideoStore, (videos) => videos.list(params.projectId)).pipe(
      Effect.mapError(unstored)
    ),

  "video.reconcile": ({ params }) =>
    Effect.flatMap(VideoStore, (videos) =>
      videos.reconcile(params.projectId, params.compositions)
    ).pipe(Effect.mapError(unstored)),

  // The repair for a video created before its project could register one, and
  // the only path that writes into someone else's project on purpose: it is a
  // button they press, on a row that says what is wrong.
  "video.register": ({ params }) =>
    Effect.gen(function* () {
      const videos = yield* VideoStore;
      const video = yield* Effect.mapError(
        videos.find(params.videoId),
        unstored
      );
      const project = yield* located(video.projectId);

      yield* Effect.mapError(ensureRegistry(project.path), unscaffolded);

      return video;
    }),

  "video.remove": ({ params }) =>
    Effect.flatMap(VideoStore, (videos) => videos.remove(params.videoId)).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "video.rename": ({ params }) =>
    Effect.flatMap(VideoStore, (videos) =>
      videos.rename(params.videoId, params.name)
    ).pipe(Effect.mapError(unstored)),

  "video.restore": ({ params }) =>
    Effect.flatMap(VideoStore, (videos) => videos.restore(params.videoId)).pipe(
      Effect.mapError(unstored)
    ),
};

// A slug has to clear the folders on disk as well as the rows: a project
// opened from someone else's tree can hold a src/videos nobody recorded.
function videoFolders(path: string): Effect.Effect<readonly string[]> {
  return Effect.promise(async () => {
    try {
      const entries = await readdir(
        join(remotionRootOf(path), "src", VIDEOS_DIR),
        {
          withFileTypes: true,
        }
      );
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  });
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

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(Math.trunc(value), low), high);
}
