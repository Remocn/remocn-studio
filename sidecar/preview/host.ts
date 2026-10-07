import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, FiberMap, Ref, Scope, Semaphore, Stream } from "effect";
import { FORMAT_SPECS, fileNameOf, withExtension } from "@/shared/export";
import {
  type ExportEvent,
  PREVIEW_ENTRY_ENV,
  type PreviewEvent,
  type Still,
  type StillEvent,
} from "@/shared/ipc";
import { type Idle, makeIdle } from "../idle";
import { libraryRoot } from "../library/store";
import { untilGone, untilOrphaned, untilSignalled } from "../lifecycle";
import { untilBroken } from "../pipes";
import {
  type BrowserReading,
  browserOptionsOf,
  prepareBrowser,
  sharedBrowser,
  signatureOf,
} from "./browser";
import {
  BUILDING,
  type BuildOutcome,
  type BuildState,
  compiled as buildCompiled,
  started as buildStarted,
  percentGate,
  pinnable,
  recovering,
  troubleIn,
} from "./build-state";
import { BUNDLE_FLAGS, isHotUpdate, renderOnly } from "./bundling";
import {
  type VideoCheck,
  videoCheckError,
  videoFindings,
  videoPlan,
} from "./choreography";
import { assemble, codemodsOf, removalOf, statusesOf } from "./codemod";
import { optionsFor, type ResolvedConfig } from "./config";
import { type ConfigCache, makeConfigCache } from "./config-host";
import {
  type DesignFinding,
  finishDesignResult,
  motionFrames,
  motionSamplingError,
} from "./design";
import { clipMedia, exporterOf, exportMedia, OUT_DIR, planFor } from "./export";
import type { RenderContext } from "./failure";
import { footageDesignFindings, measureFootage } from "./footage";
import {
  JOBS_DIR,
  type JobRegistry,
  jobServeUrl,
  makeJobRegistry,
  pinBundle,
} from "./job";
import { messagesOf, type NativeBundle, nativeBundle } from "./native";
import {
  agreedVersionIn,
  entryPointOf,
  importFrom,
  PreviewError,
  packageVersionOf,
  type RenderOptions,
  remotionRootOf,
  resolveFrom,
  type WebpackConfig,
  warmInternalsOf,
  webpackOverrideOf,
} from "./project";
import {
  type ClipCommand,
  type DesignCommand,
  decodeHostCommand,
  type ExportCommand,
  type HostReply,
  RENDER_BASE,
  type RemoveCommand,
  type SourceCommand,
  type StatusCommand,
  type StillCommand,
  type WriteCommand,
} from "./protocol";
import { libraryIndex, proxies } from "./proxies";
import { checkReadiness, readReadinessReport } from "./readiness";
import { serve } from "./server";
import { openSession, type Session, type WarmInternals } from "./session";
import { captureSourcePage } from "./source";
import {
  type CompositionCache,
  captureStill,
  DELAY_RENDER_TIMEOUT_MS,
  makeCompositionCache,
  measureComposition,
  type Renderer,
  slug,
  stillFile,
  warmComposition,
} from "./still";

const WARM_IDLE = "90 seconds";

export const PREVIEW_OUT_ENV = "REMOCN_PREVIEW_OUT";
export const PREVIEW_PARENT_ENV = "REMOCN_PREVIEW_PARENT_PID";

interface Bundler {
  BundlerInternals: {
    webpackConfig: (
      input: Record<string, unknown>
    ) => Promise<[string, WebpackConfig]>;
  };
  webpack: ((config: WebpackConfig) => Compiler) & {
    ProgressPlugin: new (handler: (percent: number) => void) => unknown;
    DefinePlugin: new (definitions: Record<string, string>) => unknown;
    optimize: {
      LimitChunkCountPlugin: new (options: { maxChunks: number }) => unknown;
    };
  };
}

interface Hook {
  tap: (name: string, handler: () => void) => void;
}

interface Watching {
  close: (done: () => void) => void;
  resume: () => void;
  suspend: () => void;
}

interface Compiler {
  hooks: { invalid: Hook; watchRun: Hook };
  watch: (
    options: Record<string, unknown>,
    handler: (error: Error | null, stats: Stats | undefined) => void
  ) => Watching;
}

type Stats = Parameters<typeof messagesOf>[0];

interface RenderCompiler {
  readonly wake: Effect.Effect<void>;
  readonly watching: Watching;
}

const frames = process.stdout.write.bind(process.stdout);

const write = (frame: HostReply | PreviewEvent) =>
  Effect.sync(() => {
    frames(`${JSON.stringify(frame)}\n`);
  });

const emit = (event: PreviewEvent) => write(event);

export const designProgress =
  (id: string) => (stage: string, completed: number, total: number) =>
    Effect.runSync(
      write({ completed, id, stage, total, type: "design-progress" })
    );

const log = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`);
  });

const TALKATIVE = ["debug", "dir", "info", "log", "table"] as const;

const keepStdoutForFrames: Effect.Effect<void> = Effect.sync(() => {
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
    (process.stderr.write as (...args: unknown[]) => boolean)(
      chunk,
      ...rest
    )) as typeof process.stdout.write;

  const onto = console.error.bind(console);

  for (const name of TALKATIVE) {
    (console as unknown as Record<string, unknown>)[name] = onto;
  }
});

export interface Booted {
  browser: Ref.Ref<{ reading: BrowserReading; signature: string } | null>;
  build: Ref.Ref<BuildState>;
  cache: CompositionCache;
  compiler: RenderCompiler;
  config: ConfigCache;
  dir: string;
  idle: Idle;
  jobs: JobRegistry;
  jobsDir: string;
  lane: Semaphore.Semaphore;
  outDir: string;
  publicDir: string;
  requests: FiberMap.FiberMap<string>;
  root: string;
  running: FiberMap.FiberMap<string>;
  serveUrl: string;
  session: Ref.Ref<Session | null>;
  staticBase: string;
}

interface Tools {
  config: ResolvedConfig;
  context: RenderContext;
  internals: WarmInternals | null;
  note: string | null;
  options: RenderOptions;
  renderer: Renderer;
}

export const runPreviewHost: Effect.Effect<void> = Effect.gen(function* () {
  yield* keepStdoutForFrames;

  const opened = process.cwd();
  const root = remotionRootOf(opened);

  const preferred = root === opened ? null : path.basename(opened);

  if (preferred !== null) {
    yield* Effect.sync(() => process.chdir(root));
    yield* log(
      `preview root for ${opened} resolved to ${root}, preferring composition ${preferred}`
    );
  }

  const booted = yield* boot(root, preferred).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`preview host failed: ${error.message}`),
        emit({ message: error.message, type: "failed" })
      ).pipe(Effect.as(null))
    )
  );

  if (booted !== null) {
    yield* Effect.forkScoped(commands(booted));
  }

  const reason = yield* Effect.raceAll([
    untilStdinClosed,
    untilBroken(process.stdout, "the sidecar closed stdout"),
    untilSignalled,
    untilGone(PREVIEW_PARENT_ENV),
    untilOrphaned,
  ]);

  yield* log(`preview host stopping: ${reason}`);
}).pipe(Effect.scoped);

function boot(root: string, preferred: string | null) {
  return Effect.gen(function* () {
    const entry = process.env[PREVIEW_ENTRY_ENV];
    const outDir = process.env[PREVIEW_OUT_ENV];

    if (entry === undefined || outDir === undefined) {
      return yield* Effect.fail(
        new PreviewError({
          message: `${PREVIEW_ENTRY_ENV} and ${PREVIEW_OUT_ENV} must both be set`,
        })
      );
    }

    yield* log(`preview host booting in ${root}`);

    const userDefinedComponent = yield* entryPointOf(root);
    const override = yield* webpackOverrideOf(root);
    const bundler = yield* importFrom<Bundler>(root, "@remotion/bundler");
    const playerPath = yield* resolveFrom(root, "@remotion/player");
    const renderEntry = yield* renderEntryOf(root);
    const version = yield* remotionVersionOf(root);
    const staticBase = `/static-${randomBytes(6).toString("hex")}`;
    const previewBase = `/preview-${randomBytes(6).toString("hex")}`;
    let native: NativeBundle | null = null;
    const cache = makeCompositionCache();
    const session = yield* Ref.make<Session | null>(null);
    const running = yield* FiberMap.make<string>();
    const requests = yield* FiberMap.make<string>();
    const lane = yield* Semaphore.make(1);
    const build = yield* Ref.make<BuildState>(BUILDING);
    const browser = yield* Ref.make<{
      reading: BrowserReading;
      signature: string;
    } | null>(null);
    const jobs = makeJobRegistry();
    const publicDir = path.join(root, "public");

    yield* Effect.addFinalizer(() => drop(session));

    const idle = yield* makeIdle(
      WARM_IDLE,
      Effect.flatMap(Ref.get(session), (held) =>
        held === null
          ? Effect.void
          : Effect.andThen(
              log(`closing the render page for ${held.composition}: idle`),
              drop(session)
            )
      )
    );

    const server = yield* serve({
      jobs,
      native: () => native,
      outDir,
      preferred,
      previewBase,
      proxies: proxies(libraryIndex(libraryRoot())),
      publicDir,
      root,
      staticBase,
      title: path.basename(root),
      version,
    });

    yield* log(`preview host serving on ${server.port}`);

    const { BundlerInternals, webpack } = bundler;

    yield* sweepHotUpdates(outDir);

    const [, config] = yield* Effect.tryPromise({
      catch: (cause) => new PreviewError({ message: String(cause) }),
      try: () =>
        BundlerInternals.webpackConfig({
          ...BUNDLE_FLAGS,
          entry,
          extraPlugins: [],
          onProgress: () => undefined,
          outDir,
          poll: null,
          remotionRoot: root,
          userDefinedComponent,
          webpackOverride: async (input: WebpackConfig) =>
            renderOnly(
              ours(await override(input), { playerPath, renderEntry })
            ),
        }),
    });

    const compiler = yield* watch(
      webpack,
      config,
      () => {
        cache.forget();
        Effect.runFork(drop(session));
        server.notifyRebuilt();
      },
      build
    );

    const shown = yield* Ref.make<BuildState>(BUILDING);
    const tick = percentGate();

    const nativeConfig = Effect.tryPromise({
      catch: (cause) => new PreviewError({ message: String(cause) }),
      try: async () => {
        const [, configured] = await BundlerInternals.webpackConfig({
          ...BUNDLE_FLAGS,
          entry,
          extraPlugins: [],
          onProgress: () => undefined,
          outDir,
          poll: null,
          remotionRoot: root,
          userDefinedComponent,
          webpackOverride: async (input: WebpackConfig) =>
            ours(await override(input), { playerPath, renderEntry }),
        });
        return configured;
      },
    });
    native = yield* nativeBundle(webpack, nativeConfig, {
      assets: `http://127.0.0.1:${server.port}${previewBase}`,
      base: `/native-${randomBytes(6).toString("hex")}`,
      compiled: (outcome) => {
        const previous = Effect.runSync(
          Ref.getAndUpdate(shown, (state) => buildCompiled(state, outcome))
        );

        if (!outcome.ok) {
          Effect.runSync(emit({ message: outcome.message, type: "failed" }));
          return;
        }

        if (previous.settled !== null) {
          cache.forget();
          Effect.runFork(drop(session));
          if (!recovering(previous)) {
            return;
          }
        }

        Effect.runSync(
          emit({ type: "ready", url: `http://127.0.0.1:${server.port}` })
        );
      },
      directory: `${outDir}-native`,
      entry,
      origin: `http://127.0.0.1:${server.port}`,
      plugins: [
        new webpack.ProgressPlugin((percent) => {
          if (percent === 0) {
            Effect.runSync(Ref.update(shown, buildStarted));
          }
          // webpack keeps reporting after the watch callback has run: its
          // cache going idle is the 100%. Sent, that tick lands after
          // `failed` and buries the compile error under a full bar.
          if (!Effect.runSync(Ref.get(shown)).compiling) {
            return;
          }
          const whole = tick(percent);
          if (whole !== null) {
            Effect.runSync(emit({ percent: whole, type: "building" }));
          }
        }),
      ],
      projectEntry: userDefinedComponent,
      rebuilt: server.notifyNativeRebuilt,
    });

    yield* Effect.forkScoped(
      native.start.pipe(
        Effect.catch((error) =>
          Effect.andThen(
            log(`the canvas preview could not start: ${error.message}`),
            emit({ message: error.message, type: "failed" })
          )
        )
      )
    );

    return {
      browser,
      build,
      cache,
      compiler,
      config: makeConfigCache(),
      dir: path.join(outDir, "..", "stills"),
      idle,
      jobs,
      jobsDir: path.join(outDir, "..", JOBS_DIR),
      lane,
      outDir,
      publicDir,
      requests,
      root,
      running,
      serveUrl: `http://127.0.0.1:${server.port}${RENDER_BASE}/index.html`,
      session,
      staticBase,
    } satisfies Booted;
  });
}

function renderEntryOf(root: string): Effect.Effect<string, PreviewError> {
  return Effect.map(
    resolveFrom(root, "@remotion/studio/renderEntry"),
    (resolved) => {
      const esm = path.join(resolved, "..", "esm", "renderEntry.mjs");
      return existsSync(esm) ? esm : resolved;
    }
  );
}

function remotionVersionOf(root: string): Effect.Effect<string> {
  return packageVersionOf(root, "remotion").pipe(
    Effect.catch(() => Effect.succeed(""))
  );
}

function ours(
  config: WebpackConfig,
  paths: { playerPath: string; renderEntry: string }
): WebpackConfig {
  const resolve = (config.resolve ?? {}) as Record<string, unknown>;
  const alias = (resolve.alias ?? {}) as Record<string, unknown>;
  const modules = (config.module ?? {}) as Record<string, unknown>;
  const rules = (modules.rules ?? []) as unknown[];

  return {
    ...config,
    module: {
      ...modules,
      rules: [...rules, { include: paths.renderEntry, sideEffects: true }],
    },
    resolve: {
      ...resolve,
      alias: {
        "@remotion/studio/renderEntry$": paths.renderEntry,
        ...alias,
        "@remotion/player": paths.playerPath,
      },
    },
  };
}

const RENDER_COMPILER = "remocn-render";

function watch(
  webpack: Bundler["webpack"],
  config: WebpackConfig,
  notifyRebuilt: () => void,
  build: Ref.Ref<BuildState>
): Effect.Effect<RenderCompiler, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      let compiled = false;
      let stale = true;

      const compiler = webpack(config);

      compiler.hooks.invalid.tap(RENDER_COMPILER, () => {
        stale = true;
      });
      compiler.hooks.watchRun.tap(RENDER_COMPILER, () => {
        stale = false;
        Effect.runSync(Ref.update(build, buildStarted));
      });

      const watching = compiler.watch({}, (error, stats) => {
        watching.suspend();

        let outcome: BuildOutcome = { ok: true };
        if (error !== null) {
          outcome = { message: error.message, ok: false };
        } else if (stats?.hasErrors()) {
          outcome = { message: messagesOf(stats), ok: false };
        }

        Effect.runSync(
          Ref.update(build, (state) => buildCompiled(state, outcome))
        );

        if (!outcome.ok) {
          Effect.runSync(
            log(`the project failed to compile: ${outcome.message}`)
          );
        }

        if (compiled) {
          notifyRebuilt();
        }
        compiled = true;
      });

      watching.suspend();

      return {
        wake: Effect.sync(() => {
          if (stale) {
            Effect.runSync(Ref.update(build, buildStarted));
            watching.resume();
          }
        }),
        watching,
      };
    }),
    ({ watching }) =>
      Effect.callback<void>((resume) => {
        watching.close(() => resume(Effect.void));
      })
  );
}

function sweepHotUpdates(outDir: string): Effect.Effect<void> {
  return Effect.tryPromise(async () => {
    const names = await readdir(outDir).catch(() => [] as string[]);
    const stale = names.filter(isHotUpdate);

    await Promise.all(
      stale.map((name) => rm(path.join(outDir, name), { force: true }))
    );

    return stale.length;
  }).pipe(
    Effect.flatMap((removed) =>
      removed > 0
        ? log(`removed ${removed} hot-update file(s) from ${outDir}`)
        : Effect.void
    ),
    Effect.ignore
  );
}

function commands(booted: Booted): Effect.Effect<void> {
  return Stream.runForEach(stdinLines, (line) => obey(booted, line)).pipe(
    Effect.ignore
  );
}

export function obey(booted: Booted, line: string): Effect.Effect<void> {
  if (line.trim().length === 0) {
    return Effect.void;
  }

  const decoded = decodeHostCommand(line);

  if (Exit.isFailure(decoded)) {
    return log(`dropped a preview command it could not parse: ${line}`);
  }

  const command = decoded.value;

  if (command.type === "cancel") {
    return Effect.andThen(
      FiberMap.remove(booted.running, command.id),
      FiberMap.remove(booted.requests, command.id)
    );
  }

  if (command.type === "export" || command.type === "clip") {
    return begin(booted, command);
  }

  if (command.type === "design") {
    if (command.mode === "full" || command.mode === "report") {
      return Effect.flatMap(FiberMap.size(booted.running), (busy) =>
        busy > 0
          ? write({
              id: command.id,
              message:
                "Another render or readiness check is running. Cancel it or wait for completion.",
              type: "design-failed",
            })
          : Effect.asVoid(
              FiberMap.run(
                booted.running,
                command.id,
                inspectFullDesign(booted, command)
              )
            )
      );
    }
    return queue(booted, command.id, inspectDesign(booted, command));
  }

  if (command.type === "source") {
    return queue(booted, command.id, captureSource(booted, command));
  }

  if (command.type === "status") {
    return readStatuses(booted, command);
  }

  if (command.type === "write") {
    return assembleWrite(booted, command);
  }

  if (command.type === "remove") {
    return assembleRemoval(booted, command);
  }

  return queue(booted, command.id, answer(booted, command));
}

function queue(
  booted: Booted,
  id: string,
  work: Effect.Effect<void>
): Effect.Effect<void> {
  return Effect.asVoid(
    FiberMap.run(booted.requests, id, booted.lane.withPermits(1)(work))
  );
}

function readStatuses(
  booted: Booted,
  command: StatusCommand
): Effect.Effect<void> {
  return codemodsOf(booted.root)
    .pipe(
      Effect.flatMap((codemods) =>
        statusesOf(codemods, command.targets, command.video)
      ),
      Effect.flatMap((targets) =>
        write({ id: command.id, targets, type: "status-done" })
      )
    )
    .pipe(
      Effect.catch((error) =>
        Effect.andThen(
          log(`prop statuses failed: ${error.message}`),
          write({
            id: command.id,
            message: error.message,
            type: "status-failed",
          })
        )
      )
    );
}

function assembleRemoval(
  booted: Booted,
  command: RemoveCommand
): Effect.Effect<void> {
  return codemodsOf(booted.root)
    .pipe(
      Effect.flatMap((codemods) =>
        removalOf(codemods, command.component, command.target, command.video)
      ),
      Effect.flatMap((removed) =>
        write({ ...removed, id: command.id, type: "remove-done" })
      )
    )
    .pipe(
      Effect.catch((error) =>
        Effect.andThen(
          log(`removal failed: ${error.message}`),
          write({
            id: command.id,
            message: error.message,
            type: "remove-failed",
          })
        )
      )
    );
}

function assembleWrite(
  booted: Booted,
  command: WriteCommand
): Effect.Effect<void> {
  return codemodsOf(booted.root)
    .pipe(
      Effect.flatMap((codemods) =>
        assemble(codemods, command.edits, command.partial)
      ),
      Effect.tap((built) =>
        log(
          `codemod assembled ${built.files.length} file(s) from ${command.edits.length} edit(s)`
        )
      ),
      Effect.flatMap((built) =>
        write({
          files: built.files,
          id: command.id,
          results: built.results,
          type: "write-done",
        })
      )
    )
    .pipe(
      Effect.catch((error) =>
        Effect.andThen(
          log(`codemod failed: ${error.message}`),
          write({
            id: command.id,
            message: error.message,
            type: "write-failed",
          })
        )
      )
    );
}

function captureSource(
  booted: Booted,
  command: SourceCommand
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const tools = yield* toolsFor(booted);
    if (tools.internals === null) {
      return yield* Effect.fail(
        new PreviewError({
          message:
            "this Remotion build does not expose the Chrome internals needed for a source screenshot",
        })
      );
    }
    const captured = yield* captureSourcePage({
      internals: tools.internals,
      options: tools.options,
      output: command.output,
      timeoutMs: tools.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS,
      url: command.url,
    });
    yield* log(`captured source ${command.url} to ${captured}`);
    return yield* write({
      id: command.id,
      path: captured,
      type: "source-done",
    });
  }).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`source capture failed: ${error.message}`),
        write({
          id: command.id,
          message: error.message,
          type: "source-failed",
        })
      )
    )
  );
}

function inspectFullDesign(
  booted: Booted,
  command: DesignCommand
): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (command.mode !== "report") {
      yield* settledBuild(booted);
    }
    const tools = yield* toolsFor(booted);
    if (command.mode === "report") {
      const result = yield* Effect.tryPromise({
        catch: (cause) => new PreviewError({ message: String(cause) }),
        try: () =>
          readReadinessReport(
            {
              composition: command.composition,
              dir: booted.dir,
              renderOptions: tools.options,
              root: booted.root,
            },
            command.reportId ?? "",
            command.options
          ),
      });
      yield* write({ id: command.id, result, type: "design-done" });
      return;
    }
    const result = yield* checkReadiness({
      composition: command.composition,
      dir: booted.dir,
      internals: tools.internals,
      motion: command.motion,
      options: command.options ?? {},
      progress: designProgress(command.id),
      publicDir: booted.publicDir,
      renderer: tools.renderer,
      renderOptions: tools.options,
      root: booted.root,
      serveUrl: booted.serveUrl,
      staticBase: booted.staticBase,
      video: command.video,
    });
    yield* write({ id: command.id, result, type: "design-done" });
  }).pipe(
    Effect.catch((error) =>
      write({ id: command.id, message: error.message, type: "design-failed" })
    )
  );
}

function inspectDesign(
  booted: Booted,
  command: DesignCommand
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const keyFrames = [...new Set(command.frames)].map((frame) =>
      Math.max(0, Math.trunc(frame))
    );

    if (keyFrames.length < 2 || keyFrames.length > 9) {
      return yield* Effect.fail(
        new PreviewError({
          message: "design_check needs between 2 and 9 distinct frames",
        })
      );
    }

    const samplingError = motionSamplingError(command.motion);
    if (samplingError !== null) {
      return yield* Effect.fail(new PreviewError({ message: samplingError }));
    }

    const sampleFrames = [
      ...new Set([
        ...keyFrames,
        ...motionFrames(command.motion).map((frame) =>
          Math.max(0, Math.trunc(frame))
        ),
      ]),
    ].sort((left, right) => left - right);
    const selectors = command.motion.map(({ selector }) => selector);

    yield* settledBuild(booted);
    const tools = yield* toolsFor(booted);
    const session = yield* warmed(
      booted,
      command.composition,
      tools,
      () => undefined
    );

    if (session === null) {
      return yield* Effect.fail(
        new PreviewError({
          message:
            "this Remotion build can render stills but does not expose the warm page needed for design_check",
        })
      );
    }

    if (command.video !== null) {
      const invalid = videoCheckError(command.video, session.durationInFrames);
      if (invalid !== null) {
        return yield* Effect.fail(new PreviewError({ message: invalid }));
      }
    }

    const folder = yield* freshDesignFolder(booted.dir);
    const audits = yield* Effect.forEach(sampleFrames, (frame) => {
      const output = path.join(
        folder,
        `${slug(command.composition)}-frame-${frame}.png`
      );
      return session
        .audit(frame, output, selectors)
        .pipe(Effect.map((audit) => ({ audit, frame, output })));
    });

    const video =
      command.video === null
        ? []
        : yield* choreographyPass(session, command.video);

    const footage = yield* measureFootage({
      fps: session.fps,
      publicDir: booted.publicDir,
      root: booted.root,
      serveUrl: booted.serveUrl,
      sightings: audits.map(({ audit, frame }) => ({
        footage: audit.footage,
        frame,
      })),
      staticBase: booted.staticBase,
    });

    const result = finishDesignResult({
      assertions: command.motion,
      audits,
      composition: command.composition,
      footage: footageDesignFindings(footage),
      height: session.height,
      snapshots: audits.map(({ frame, output }) => ({ frame, path: output })),
      video,
      width: session.width,
    });

    yield* log(
      `design check of ${command.composition} found ${result.findings.length} issue(s) across ${sampleFrames.length} frames`
    );
    return yield* write({ id: command.id, result, type: "design-done" });
  }).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`design check failed: ${error.message}`),
        write({
          id: command.id,
          message: error.message,
          type: "design-failed",
        })
      )
    ),
    booted.idle.hold
  );
}

function choreographyPass(
  session: Session,
  video: VideoCheck
): Effect.Effect<readonly DesignFinding[], PreviewError> {
  return Effect.gen(function* () {
    const plan = videoPlan(video, session.durationInFrames);
    const started = Date.now();
    const samples = yield* Effect.forEach(plan.frames, (frame) =>
      session
        .probe(frame, video.camera)
        .pipe(Effect.map((probe) => ({ ...probe, frame })))
    );
    const spent = Date.now() - started;

    yield* log(
      `choreography pass sampled ${samples.length} frames across ${video.scenes.length} scenes and ${plan.boundaries.length} boundaries in ${spent}ms`
    );

    return videoFindings({ fps: session.fps, plan, samples, video });
  });
}

function freshDesignFolder(dir: string): Effect.Effect<string, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) => new PreviewError({ message: String(cause) }),
    try: async () => {
      await mkdir(dir, { recursive: true });
      const stale = await readdir(dir);
      await Promise.all(
        stale
          .filter((name) => name.startsWith("design-"))
          .map((name) =>
            rm(path.join(dir, name), { force: true, recursive: true })
          )
      );
      const folder = path.join(dir, `design-${randomBytes(4).toString("hex")}`);
      await mkdir(folder, { recursive: true });
      return folder;
    },
  });
}

// One encoder at a time, whatever it is encoding: a clip asked for while an
// export runs is refused rather than queued — the save it decorates must not
// wait minutes for a render it does not need.
function begin(
  booted: Booted,
  command: ExportCommand | ClipCommand
): Effect.Effect<void> {
  return Effect.flatMap(FiberMap.size(booted.running), (busy) => {
    if (busy > 0) {
      return command.type === "clip"
        ? write({
            id: command.id,
            message: "an export is running in this project, so no clip now",
            type: "clip-failed",
          })
        : write({
            id: command.id,
            message:
              "an export is already running in this project — cancel it before starting another",
            type: "export-failed",
          });
    }

    return Effect.asVoid(
      FiberMap.run(
        booted.running,
        command.id,
        command.type === "clip"
          ? shipClip(booted, command)
          : ship(booted, command)
      )
    );
  });
}

function shipClip(booted: Booted, command: ClipCommand): Effect.Effect<void> {
  const { composition, frame, id } = command;

  return Effect.gen(function* () {
    yield* settledBuild(booted);
    const tools = yield* toolsFor(booted);
    const renderer = yield* exporterOf(tools.renderer);

    yield* log(`clip of ${composition} at ${frame} starting`);

    const browser = yield* sharedBrowser(tools.renderer, tools.options);

    const path_ = yield* clipMedia({
      browser,
      cache: booted.cache,
      composition,
      context: tools.context,
      dir: booted.dir,
      frame,
      options: tools.options,
      renderer,
      serveUrl: booted.serveUrl,
    });

    yield* log(`clip wrote ${path_}`);

    return yield* write({ id, path: path_, type: "clip-done" });
  }).pipe(
    Effect.scoped,
    Effect.catch((error) =>
      Effect.andThen(
        log(`clip failed: ${error.message}`),
        write({ id, message: error.message, type: "clip-failed" })
      )
    ),
    Effect.onInterrupt(() => log(`clip of ${composition} was cancelled`))
  );
}

function outputFor(
  booted: Booted,
  command: ExportCommand
): { changed: boolean; path: string } {
  if (command.outputPath !== null) {
    return withExtension(
      path.isAbsolute(command.outputPath)
        ? command.outputPath
        : path.join(booted.root, command.outputPath),
      command.format
    );
  }

  return {
    changed: false,
    path: path.join(
      booted.root,
      OUT_DIR,
      fileNameOf({
        composition: command.composition,
        format: command.format,
        preset: command.preset,
      })
    ),
  };
}

function ship(booted: Booted, command: ExportCommand): Effect.Effect<void> {
  const { composition, id } = command;

  const progress = (event: ExportEvent) =>
    Effect.runSync(write({ event, id, type: "export-progress" }));

  return Effect.gen(function* () {
    yield* Effect.sync(() => progress({ stage: "preparing", type: "stage" }));

    yield* agreedVersionIn(booted.root);
    const settled = yield* compiledBuild(booted);

    const tools = yield* toolsFor(booted, () => undefined, true);
    const renderer = yield* exporterOf(tools.renderer);

    const job = yield* pinBundle({
      jobsDir: booted.jobsDir,
      outDir: booted.outDir,
      publicDir: booted.publicDir,
      registry: booted.jobs,
    });

    yield* unchangedSince(booted.build, settled);

    const serveUrl = jobServeUrl(portOf(booted.serveUrl), job);

    yield* log(
      `export of ${composition} starting from pinned bundle ${job.id} into ${command.format}`
    );

    const measuring = yield* Scope.fork(yield* Scope.Scope);
    const opened = yield* Scope.provide(
      sharedBrowser(tools.renderer, tools.options),
      measuring
    );

    const measured = yield* measureComposition({
      browser: opened,
      composition,
      context: tools.context,
      options: tools.options,
      renderer: tools.renderer,
      serveUrl,
    });

    const settings = {
      format: command.format,
      preset: command.preset,
      quality: command.quality,
      resolution: command.resolution,
    };

    const output = outputFor(booted, command);

    if (output.changed) {
      yield* Effect.sync(() =>
        progress({
          message: `Saved as ${path.basename(output.path)}: the renderer will not write ${command.format.toUpperCase()} to a file that does not end in .${FORMAT_SPECS[command.format].extension}.`,
          type: "notice",
        })
      );
    }

    const { dropped, plan } = planFor({
      config: tools.config,
      outputPath: output.path,
      settings,
      size: { height: measured.height, width: measured.width },
    });

    const browser =
      plan.scale === 1
        ? opened
        : yield* Effect.andThen(
            Scope.close(measuring, Exit.void),
            sharedBrowser(tools.renderer, tools.options, plan.scale)
          );

    for (const one of dropped) {
      yield* log(`export dropped ${one.name}: ${one.reason}`);
      yield* Effect.sync(() =>
        progress({
          message: `${one.name} from remotion.config.ts was left out — ${one.reason}.`,
          type: "notice",
        })
      );
    }

    if (tools.note !== null) {
      yield* Effect.sync(() =>
        progress({ message: tools.note ?? "", type: "notice" })
      );
    }

    if (tools.config.ffmpegOverride) {
      yield* Effect.sync(() =>
        progress({
          message:
            "This project sets an ffmpeg override in remotion.config.ts, which an export from the studio does not apply.",
          type: "notice",
        })
      );
    }

    const exported = yield* exportMedia({
      browser,
      composition,
      context: tools.context,
      measured,
      onEvent: progress,
      options: tools.options,
      plan,
      renderer,
      serveUrl,
    });

    yield* log(`export wrote ${exported.bytes} bytes to ${exported.path}`);

    return exported;
  }).pipe(
    // The scope closes — and with it the copy this job rendered from — before
    // the answer goes out, so a person who exports twice in a row is never
    // told an export is already running by a job that has in fact finished.
    Effect.scoped,
    Effect.flatMap((exported) => write({ exported, id, type: "export-done" })),
    Effect.catch((error) =>
      Effect.andThen(
        log(`export failed: ${error.message}`),
        write({ id, message: error.message, type: "export-failed" })
      )
    ),
    Effect.onInterrupt(() => log(`export of ${composition} was cancelled`))
  );
}

function portOf(serveUrl: string): number {
  try {
    return Number(new URL(serveUrl).port);
  } catch {
    return 0;
  }
}

function answer(booted: Booted, command: StillCommand): Effect.Effect<void> {
  const { composition, id } = command;

  const progress = (event: StillEvent) =>
    Effect.runSync(write({ event, id, type: "still-progress" }));

  return settledBuild(booted).pipe(
    Effect.andThen(toolsFor(booted, progress)),
    Effect.flatMap((tools) =>
      command.type === "warm"
        ? Effect.andThen(
            warmed(booted, composition, tools, progress),
            write({ id, type: "warm-done" })
          )
        : shoot(booted, command, tools, progress).pipe(
            Effect.flatMap((still) => write({ id, still, type: "still-done" }))
          )
    ),
    Effect.catch((error) =>
      Effect.andThen(
        log(`preview ${command.type} failed: ${error.message}`),
        write({ id, message: error.message, type: "still-failed" })
      )
    ),
    booted.idle.hold
  );
}

// One browser policy for every renderer-backed operation: the export, the
// stills behind Snapshot, the clip, the design check and the source capture
// all come through here, so a GL backend is decided once and measured once.
function toolsFor(
  booted: Booted,
  onEvent: (event: StillEvent) => void = () => undefined,
  fresh = false
): Effect.Effect<Tools, PreviewError> {
  return Effect.gen(function* () {
    const config = yield* booted.config.read(booted.root, fresh);

    const internals = yield* warmInternalsOf(booted.root).pipe(
      Effect.catch(() => Effect.succeed(null))
    );
    const module = yield* importFrom<unknown>(
      booted.root,
      "@remotion/renderer"
    );
    const renderer = rendererOf(module);

    const signature = signatureOf(browserOptionsOf(config, process.platform));
    const held = yield* Ref.get(booted.browser);

    if (held !== null && held.signature === signature) {
      return {
        config,
        context: held.reading.context,
        internals,
        note: held.reading.note,
        options: held.reading.options,
        renderer,
      } satisfies Tools;
    }

    const reading = yield* prepareBrowser({
      config,
      internals,
      onEvent,
      platform: process.platform,
      renderer,
    });

    yield* Ref.set(booted.browser, { reading, signature });
    yield* log(
      `render browser: ${String(reading.options.chromiumOptions.gl)} (${reading.context.glSource}), WebGL ${reading.context.support}${reading.note === null ? "" : ` — ${reading.note}`}`
    );

    for (const problem of config.problems) {
      yield* log(`render setting ${problem.id}: ${problem.message}`);
    }

    return {
      config,
      context: reading.context,
      internals,
      note: reading.note,
      options: reading.options,
      renderer,
    } satisfies Tools;
  });
}

const BUILD_PATIENCE_MS = 180_000;

export const STILL_COMPILING =
  "The project is still compiling; try again in a moment.";

function waitUntil(
  build: Ref.Ref<BuildState>,
  done: (state: BuildState) => boolean
): Effect.Effect<BuildState> {
  return Effect.gen(function* () {
    const state = yield* Ref.get(build);

    if (done(state)) {
      return state;
    }

    yield* Effect.sleep(100);
    return yield* waitUntil(build, done);
  });
}

function compiledBuild(
  booted: Booted
): Effect.Effect<BuildState, PreviewError> {
  return Effect.flatMap(settledBuild(booted), (settled) => {
    const trouble = troubleIn(settled);

    return trouble === null
      ? Effect.succeed(settled)
      : Effect.fail(
          new PreviewError({
            message: `the project does not compile, so there is nothing to render:\n\n${trouble}`,
          })
        );
  });
}

export function settledBuild(
  booted: Pick<Booted, "build" | "compiler">
): Effect.Effect<BuildState, PreviewError> {
  return Effect.gen(function* () {
    yield* booted.compiler.wake;

    return yield* waitUntil(
      booted.build,
      (state) => pinnable(state) && !state.compiling
    ).pipe(
      Effect.timeoutOrElse({
        duration: BUILD_PATIENCE_MS,
        orElse: () =>
          Effect.flatMap(Ref.get(booted.build), (state) =>
            Effect.fail(
              new PreviewError({
                message: pinnable(state)
                  ? STILL_COMPILING
                  : "the project has not finished compiling, so there is nothing to render from yet",
              })
            )
          ),
      })
    );
  });
}

export function unchangedSince(
  build: Ref.Ref<BuildState>,
  settled: BuildState
): Effect.Effect<void, PreviewError> {
  return Effect.flatMap(Ref.get(build), (now) =>
    now === settled
      ? Effect.void
      : Effect.fail(new PreviewError({ message: STILL_COMPILING }))
  );
}

function warmed(
  booted: Booted,
  composition: string,
  tools: Tools,
  _onEvent: (event: StillEvent) => void
): Effect.Effect<Session | null, PreviewError> {
  return Effect.gen(function* () {
    if (tools.internals === null) {
      yield* log(
        "this Remotion build does not expose what a warm render page needs, so every capture will load its own"
      );
      return null;
    }

    const held = yield* Ref.get(booted.session);

    if (held !== null && held.composition === composition) {
      return held;
    }

    const measured = yield* warmComposition({
      cache: booted.cache,
      composition,
      options: tools.options,
      renderer: tools.renderer,
      serveUrl: booted.serveUrl,
    });

    yield* drop(booted.session);

    const opened = yield* openSession({
      composition,
      internals: tools.internals,
      measured,
      options: tools.options,
      root: booted.root,
      serveUrl: booted.serveUrl,
      timeoutMs: tools.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS,
    });

    yield* Ref.set(booted.session, opened);
    yield* log(`preview render page warmed for ${composition}`);

    return opened;
  });
}

function shoot(
  booted: Booted,
  command: { composition: string; frame: number },
  tools: Tools,
  onEvent: (event: StillEvent) => void
): Effect.Effect<Still, PreviewError> {
  return Effect.gen(function* () {
    const session = yield* warmed(
      booted,
      command.composition,
      tools,
      onEvent
    ).pipe(Effect.catch(() => Effect.succeed(null)));

    if (session === null) {
      return yield* captureStill({
        cache: booted.cache,
        context: tools.context,
        dir: booted.dir,
        extra: optionsFor(tools.config, "still"),
        onEvent,
        options: tools.options,
        renderer: tools.renderer,
        request: command,
        serveUrl: booted.serveUrl,
      });
    }

    yield* Effect.sync(() => onEvent({ type: "rendering" }));

    const output = yield* stillFile(booted.dir, command);

    yield* session.capture(Math.max(0, Math.trunc(command.frame)), output);

    return { height: session.height, path: output, width: session.width };
  });
}

function drop(session: Ref.Ref<Session | null>): Effect.Effect<void> {
  return Effect.flatMap(Ref.getAndSet(session, null), (held) =>
    held === null ? Effect.void : held.close
  );
}

function rendererOf(module: unknown): Renderer {
  const found = module as Record<string, unknown> & { default?: unknown };

  return (
    typeof found.renderStill === "function" ? found : (found.default ?? found)
  ) as Renderer;
}

const stdinLines: Stream.Stream<string> = Stream.suspend(() =>
  Stream.fromAsyncIterable(
    createInterface({
      crlfDelay: Number.POSITIVE_INFINITY,
      input: process.stdin,
    }),
    () => undefined
  ).pipe(Stream.catch(() => Stream.empty))
);

const untilStdinClosed: Effect.Effect<string> = Effect.callback<string>(
  (resume) => {
    const done = () => resume(Effect.succeed("the sidecar closed stdin"));

    process.stdin.on("end", done);
    process.stdin.on("close", done);
    process.stdin.resume();

    return Effect.sync(() => {
      process.stdin.off("end", done);
      process.stdin.off("close", done);
    });
  }
);
