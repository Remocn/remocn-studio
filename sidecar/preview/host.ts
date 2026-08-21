import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, FiberMap, Ref, Stream } from "effect";
import {
  type ExportEvent,
  GRAB_SCRIPT_ENV,
  PREVIEW_ENTRY_ENV,
  type PreviewEvent,
  type Still,
  type StillEvent,
} from "@/shared/ipc";
import { libraryRoot } from "../library/store";
import { untilGone, untilOrphaned, untilSignalled } from "../lifecycle";
import { finishDesignResult } from "./design";
import { clipMedia, exporterOf, exportMedia } from "./export";
import { withoutWebFonts } from "./grab";
import {
  agreedVersionIn,
  entryPointOf,
  importFrom,
  PreviewError,
  packageVersionOf,
  type RenderOptions,
  remotionRootOf,
  renderOptionsOf,
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
  type SourceCommand,
  type StillCommand,
} from "./protocol";
import { libraryIndex, proxies } from "./proxies";
import { serve } from "./server";
import { openSession, type Session, type WarmInternals } from "./session";
import { captureSourcePage } from "./source";
import {
  type CompositionCache,
  captureStill,
  DELAY_RENDER_TIMEOUT_MS,
  makeCompositionCache,
  type Renderer,
  readyBrowser,
  slug,
  stillFile,
  warmComposition,
} from "./still";

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
  };
}

interface Compiler {
  watch: (
    options: Record<string, unknown>,
    handler: (error: Error | null, stats: Stats | undefined) => void
  ) => { close: (done: () => void) => void };
}

interface Stats {
  hasErrors: () => boolean;
  toJson: (options: Record<string, boolean>) => {
    errors?: { message?: string }[];
  };
}

const frames = process.stdout.write.bind(process.stdout);

const write = (frame: HostReply | PreviewEvent) =>
  Effect.sync(() => {
    frames(`${JSON.stringify(frame)}\n`);
  });

const emit = (event: PreviewEvent) => write(event);

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

interface Booted {
  cache: CompositionCache;
  dir: string;
  root: string;
  running: FiberMap.FiberMap<string>;
  serveUrl: string;
  session: Ref.Ref<Session | null>;
}

interface Tools {
  internals: WarmInternals | null;
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
    const grab = yield* grabScript;
    const cache = makeCompositionCache();
    const session = yield* Ref.make<Session | null>(null);
    const running = yield* FiberMap.make<string>();

    yield* Effect.addFinalizer(() => drop(session));

    const server = yield* serve({
      grab,
      outDir,
      preferred,
      previewBase,
      proxies: proxies(libraryIndex(libraryRoot())),
      publicDir: path.join(root, "public"),
      root,
      staticBase,
      title: path.basename(root),
      version,
    });

    yield* log(`preview host serving on ${server.port}`);

    const { BundlerInternals, webpack } = bundler;

    const [, config] = yield* Effect.tryPromise({
      catch: (cause) => new PreviewError({ message: String(cause) }),
      try: () =>
        BundlerInternals.webpackConfig({
          askAIEnabled: false,
          bufferStateDelayInMilliseconds: 300,
          enableCaching: true,
          entry,
          environment: "development",
          experimentalClientSideRenderingEnabled: false,
          extraPlugins: [
            new webpack.ProgressPlugin((percent) => {
              Effect.runSync(
                emit({ percent: Math.round(percent * 100), type: "building" })
              );
            }),
          ],
          keyboardShortcutsEnabled: false,
          maxTimelineTracks: 15,
          onProgress: () => undefined,
          outDir,
          poll: null,
          remotionRoot: root,
          userDefinedComponent,
          webpackOverride: async (input: WebpackConfig) =>
            ours(await override(input), { playerPath, renderEntry }),
        }),
    });

    yield* watch(
      webpack,
      config,
      () => {
        cache.forget();
        Effect.runFork(drop(session));
        server.notifyRebuilt();
      },
      server.port
    );

    return {
      cache,
      dir: path.join(outDir, "..", "stills"),
      root,
      running,
      serveUrl: `http://127.0.0.1:${server.port}${RENDER_BASE}/index.html`,
      session,
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

const grabScript: Effect.Effect<string | null> = Effect.gen(function* () {
  const file = process.env[GRAB_SCRIPT_ENV];

  if (file === undefined) {
    yield* log(`${GRAB_SCRIPT_ENV} is not set, so Inspect is unavailable`);
    return null;
  }

  const source = yield* Effect.tryPromise(() => readFile(file, "utf8")).pipe(
    Effect.catch((cause) =>
      log(`could not read ${file}: ${String(cause)}`).pipe(Effect.as(null))
    )
  );

  if (source === null) {
    return null;
  }

  const stripped = withoutWebFonts(source);
  yield* log(
    `serving grab from ${file}, ${stripped.removed} web font import(s) removed`
  );

  return stripped.source;
});

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

function watch(
  webpack: Bundler["webpack"],
  config: WebpackConfig,
  notifyRebuilt: () => void,
  port: number
) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      let ready = false;

      const compiler = webpack(config);

      return compiler.watch({}, (error, stats) => {
        if (error !== null) {
          Effect.runSync(emit({ message: error.message, type: "failed" }));
          return;
        }

        if (stats?.hasErrors()) {
          Effect.runSync(emit({ message: messagesOf(stats), type: "failed" }));
          return;
        }

        if (ready) {
          notifyRebuilt();
          return;
        }

        ready = true;
        Effect.runSync(
          emit({ type: "ready", url: `http://127.0.0.1:${port}` })
        );
      });
    }),
    (watching) =>
      Effect.callback<void>((resume) => {
        watching.close(() => resume(Effect.void));
      })
  );
}

function messagesOf(stats: Stats): string {
  const errors = stats.toJson({ errors: true }).errors ?? [];
  const text = errors
    .map((error) => error.message ?? "")
    .filter((message) => message.length > 0)
    .join("\n\n");

  return text.length > 0 ? text : "the project failed to compile";
}

function commands(booted: Booted): Effect.Effect<void> {
  return Stream.runForEach(stdinLines, (line) => obey(booted, line)).pipe(
    Effect.ignore
  );
}

function obey(booted: Booted, line: string): Effect.Effect<void> {
  if (line.trim().length === 0) {
    return Effect.void;
  }

  const decoded = decodeHostCommand(line);

  if (Exit.isFailure(decoded)) {
    return log(`dropped a preview command it could not parse: ${line}`);
  }

  const command = decoded.value;

  if (command.type === "cancel") {
    return FiberMap.remove(booted.running, command.id);
  }

  if (command.type === "export" || command.type === "clip") {
    return begin(booted, command);
  }

  if (command.type === "design") {
    return inspectDesign(booted, command);
  }

  if (command.type === "source") {
    return captureSource(booted, command);
  }

  return answer(booted, command);
}

function captureSource(
  booted: Booted,
  command: SourceCommand
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const tools = yield* toolsFor(booted.root);
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

function inspectDesign(
  booted: Booted,
  command: DesignCommand
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const sampleFrames = [...new Set(command.frames)]
      .map((frame) => Math.max(0, Math.trunc(frame)))
      .sort((left, right) => left - right);

    if (sampleFrames.length < 2 || sampleFrames.length > 9) {
      return yield* Effect.fail(
        new PreviewError({
          message: "design_check needs between 2 and 9 distinct frames",
        })
      );
    }

    const tools = yield* toolsFor(booted.root);
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

    const folder = yield* freshDesignFolder(booted.dir);
    const audits = yield* Effect.forEach(sampleFrames, (frame) => {
      const output = path.join(
        folder,
        `${slug(command.composition)}-frame-${frame}.png`
      );
      return session
        .audit(frame, output)
        .pipe(Effect.map((audit) => ({ audit, frame, output })));
    });

    const result = finishDesignResult({
      audits,
      composition: command.composition,
      height: session.height,
      snapshots: audits.map(({ frame, output }) => ({ frame, path: output })),
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
    )
  );
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
    const tools = yield* toolsFor(booted.root);
    const renderer = yield* exporterOf(tools.renderer);

    yield* log(`clip of ${composition} at ${frame} starting`);

    const path_ = yield* clipMedia({
      cache: booted.cache,
      composition,
      dir: booted.dir,
      frame,
      options: tools.options,
      renderer,
      serveUrl: booted.serveUrl,
    });

    yield* log(`clip wrote ${path_}`);

    return yield* write({ id, path: path_, type: "clip-done" });
  }).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`clip failed: ${error.message}`),
        write({ id, message: error.message, type: "clip-failed" })
      )
    ),
    Effect.onInterrupt(() => log(`clip of ${composition} was cancelled`))
  );
}

function ship(booted: Booted, command: ExportCommand): Effect.Effect<void> {
  const { composition, id } = command;

  const progress = (event: ExportEvent) =>
    Effect.runSync(write({ event, id, type: "export-progress" }));

  return Effect.gen(function* () {
    yield* agreedVersionIn(booted.root);

    const tools = yield* toolsFor(booted.root);
    const renderer = yield* exporterOf(tools.renderer);

    yield* log(`export of ${composition} starting`);

    const exported = yield* exportMedia({
      cache: booted.cache,
      composition,
      onEvent: progress,
      options: tools.options,
      renderer,
      root: booted.root,
      serveUrl: booted.serveUrl,
    });

    yield* log(`export wrote ${exported.bytes} bytes to ${exported.path}`);

    return yield* write({ exported, id, type: "export-done" });
  }).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`export failed: ${error.message}`),
        write({ id, message: error.message, type: "export-failed" })
      )
    ),
    Effect.onInterrupt(() => log(`export of ${composition} was cancelled`))
  );
}

function answer(booted: Booted, command: StillCommand): Effect.Effect<void> {
  const { composition, id } = command;

  const progress = (event: StillEvent) =>
    Effect.runSync(write({ event, id, type: "still-progress" }));

  return toolsFor(booted.root).pipe(
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
    )
  );
}

function toolsFor(root: string): Effect.Effect<Tools, PreviewError> {
  return Effect.all({
    internals: warmInternalsOf(root).pipe(
      Effect.catch(() => Effect.succeed(null))
    ),
    module: importFrom<unknown>(root, "@remotion/renderer"),
    options: renderOptionsOf(root),
  }).pipe(
    Effect.map(({ internals, module, options }) => ({
      internals,
      options,
      renderer: rendererOf(module),
    }))
  );
}

function warmed(
  booted: Booted,
  composition: string,
  tools: Tools,
  onEvent: (event: StillEvent) => void
): Effect.Effect<Session | null, PreviewError> {
  return Effect.gen(function* () {
    yield* readyBrowser({
      onEvent,
      options: tools.options,
      renderer: tools.renderer,
    });

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
        dir: booted.dir,
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
