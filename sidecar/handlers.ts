import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import { crashLine } from "@/shared/crash";
import { DATA_DIR_ENV, SIDECAR_PROTOCOL } from "@/shared/ipc";
import { AGENT_PROVIDERS } from "@/shared/providers";
import { freeSlug, slugFor } from "@/shared/slug";
import { templateProjectName } from "@/shared/templates";
import { makeAccountCache } from "./agent/account";
import { makeGate } from "./agent/gate";
import { adapterFor, forgetChat } from "./agent/registry";
import { answerSourceAsset } from "./agent/source";
import { locate, openTurn, runTurn } from "./agent/turn";
import { turnTools } from "./agent/turn-tools";
import { escapee } from "./contained";
import { applyCrashConsent, isReporting } from "./crash";
import { readProjectDocument, videoDocuments } from "./documents";
import { projectChecks } from "./environment";
import { type FilesError, listFolder, projectFiles } from "./files";
import { openStudioProject, ProjectStore } from "./history/projects";
import { HistoryStore } from "./history/store";
import { VideoStore } from "./history/videos";
import { HandlerError, type Handlers } from "./host";
import { recoverSounds } from "./integrations/sounds";
import { listBundled } from "./library/bundled";
import { listShaders } from "./library/shaders";
import {
  type StockError,
  saveStock,
  searchStock,
  stockConfigured,
} from "./library/stock";
import {
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
import { installNode } from "./node-installer";
import { remotionRootOf } from "./preview/project";
import { removals } from "./preview/removals";
import {
  exportFrom,
  previewEvents,
  removeFrom,
  statusFrom,
  stillFrom,
  stopProjectPreview,
  warmFrom,
  writeFrom,
} from "./preview/supervisor";
import {
  confirmBrandApplication,
  projectBrand,
  readBrandApplication,
} from "./projects/apply";
import { importBrandFile, snapshotOf, writeSnapshot } from "./projects/brand";
import { configEffect, getConfig, saveConfig } from "./projects/config";
import { importDesignMarkdown } from "./projects/design-import";
import { brandStarter } from "./projects/font-runtime";
import { googleFont } from "./projects/fonts";
import {
  cancelProjectMove,
  moveProjectFiles,
  prepareMove,
} from "./projects/move";
import { makeShaderInsertions } from "./projects/shader-insertion";
import {
  makeShaderPreparations,
  preparationOffer,
} from "./projects/shader-preparation";
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

const located = (projectId: string) =>
  locate(projectId).pipe(Effect.mapError(unstored));

const shaderServices = new Map<
  string,
  ReturnType<typeof makeShaderInsertions> & {
    preparation: ReturnType<typeof makeShaderPreparations>;
  }
>();
function shaderService() {
  const directory = process.env[DATA_DIR_ENV];
  if (!directory) {
    return Effect.fail(
      new HandlerError({
        message:
          "Studio's data folder is unavailable; shader preparation cannot be recovered safely.",
      })
    );
  }
  const known = shaderServices.get(directory);
  if (known) {
    return Effect.succeed(known);
  }
  const service = {
    ...makeShaderInsertions(directory),
    preparation: makeShaderPreparations(directory),
  };
  shaderServices.set(directory, service);
  return Effect.succeed(service);
}

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

  "agent.prompt": ({ ask, emit, log, params }) =>
    Effect.gen(function* () {
      const ports = {
        adapterFor,
        brand: projectBrand,
        emit,
        gate,
        gateway,
        log,
        tools: (turn: import("./agent/turn").TurnContext) =>
          turnTools(turn, { ask }),
      };
      if (!params.shaderPreparation) {
        return yield* runTurn(params, ports).pipe(Effect.mapError(unstored));
      }
      const project = yield* located(params.projectId);
      const videos = yield* VideoStore;
      const video = yield* videos
        .find(params.videoId)
        .pipe(Effect.mapError(unstored));
      if (video.projectId !== project.id) {
        return yield* Effect.fail(
          new HandlerError({
            message: "This video belongs to another project.",
          })
        );
      }
      const store = yield* HistoryStore;
      const blocks = yield* store
        .blocks(params.historyId)
        .pipe(Effect.mapError(unstored));
      if (
        params.sessionId !== null ||
        blocks.length > 0 ||
        params.assets.length ||
        params.media.length ||
        params.elements.length ||
        params.attachments.length ||
        params.brandRevision !== undefined
      ) {
        return yield* Effect.fail(
          new HandlerError({
            message:
              "Start shader preparation in a new chat without attachments.",
          })
        );
      }
      const service = yield* shaderService();
      yield* service
        .invalidate(project.path, video.compositionId)
        .pipe(Effect.mapError(unstored));
      return yield* service.preparation
        .run(
          {
            historyId: params.historyId,
            revision: params.shaderPreparation.revision,
            root: remotionRootOf(project.path),
            video: video.compositionId,
          },
          (workspace) =>
            runTurn(
              { ...params, prompt: workspace.feedback ?? params.prompt },
              {
                ...ports,
                brand: {
                  begin: () =>
                    Effect.succeed({ application: null, brief: null }),
                  finish: () => Effect.void,
                },
                workspace,
              }
            ),
          service.waitForPrepared(project.path, project.id, video.compositionId)
        )
        .pipe(Effect.mapError(unstored));
    }),

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
  // has to be in the transcript.
  "history.record": ({ log, params }) =>
    Effect.map(openTurn(params, log), (recorder) => ({
      session: recorder.session,
    })),

  "history.remove": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.remove(params.sessionId)
    ).pipe(
      Effect.tap(() => forgetChat(params.sessionId)),
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

  // The official installer is a macOS .pkg; elsewhere the webview opens the
  // Node.js download page instead and never asks for this.
  "node.install": ({ emit }) =>
    process.platform === "darwin"
      ? installNode((event) => emit(event)).pipe(
          Effect.mapError(
            (error) => new HandlerError({ message: error.message })
          )
        )
      : Effect.fail(
          new HandlerError({
            message: "The Node.js installer only runs on macOS",
          })
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
  "shader.insert": ({ params, emit }) =>
    Effect.gen(function* () {
      const project = yield* located(params.target.projectId);
      const service = yield* shaderService();
      const preparation = yield* service.preparation
        .status(remotionRootOf(project.path), params.target.video)
        .pipe(Effect.mapError(unstored));
      if (
        preparation &&
        preparation.phase !== "ready" &&
        preparation.phase !== "failed"
      ) {
        return yield* Effect.fail(
          new HandlerError({
            message:
              "Wait for video preparation and preview validation before inserting a shader.",
          })
        );
      }
      return yield* service
        .insert(project.path, params, emit)
        .pipe(
          Effect.mapError(
            (error) => new HandlerError({ message: error.message })
          )
        );
    }),
  "shader.insertionStatus": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      const service = yield* shaderService();
      return yield* service
        .status(project.path, params.video, params.operationId)
        .pipe(
          Effect.mapError(
            (error) => new HandlerError({ message: error.message })
          )
        );
    }),
  "shader.list": () =>
    listShaders().pipe(
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),
  "shader.targets": ({ params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);
      const service = yield* shaderService();
      const root = remotionRootOf(project.path);
      const preparation = yield* service.preparation
        .status(root, params.video)
        .pipe(Effect.mapError(unstored));
      const result = yield* service.targets(project.path, params).pipe(
        Effect.catch((error) =>
          preparationOffer(root, params.video).pipe(
            Effect.map((revision) => ({
              adaptation: false,
              preparationRevision: revision,
              reason: error.message,
              targets: [],
            })),
            Effect.catch(() =>
              Effect.succeed({
                adaptation: false,
                reason: error.message,
                targets: [],
              })
            )
          )
        )
      );
      if (
        preparation &&
        preparation.phase !== "ready" &&
        preparation.phase !== "failed"
      ) {
        return {
          ...result,
          preparation,
          reason: preparation.message,
          targets: [],
        };
      }
      return { ...result, ...(preparation ? { preparation } : {}) };
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

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(Math.trunc(value), low), high);
}
