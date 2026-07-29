import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, Stream } from "effect";
import {
  GRAB_SCRIPT_ENV,
  PREVIEW_ENTRY_ENV,
  type PreviewEvent,
} from "@/shared/ipc";
import { untilGone, untilOrphaned, untilSignalled } from "../lifecycle";
import { withoutWebFonts } from "./grab";
import {
  entryPointOf,
  importFrom,
  PreviewError,
  remotionRootOf,
  resolveFrom,
  type WebpackConfig,
  webpackOverrideOf,
} from "./project";
import { decodeHostCommand, type HostReply, RENDER_BASE } from "./protocol";
import { serve } from "./server";
import { captureStill, type Renderer } from "./still";

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
  dir: string;
  root: string;
  serveUrl: string;
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
    const grab = yield* grabScript;

    const server = yield* serve({
      grab,
      outDir,
      preferred,
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

    yield* watch(webpack, config, server.notifyRebuilt, server.port);

    return {
      dir: path.join(outDir, "..", "stills"),
      root,
      serveUrl: `http://127.0.0.1:${server.port}${RENDER_BASE}/index.html`,
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
  return resolveFrom(root, "remotion/package.json").pipe(
    Effect.flatMap((manifest) =>
      Effect.tryPromise(() => readFile(manifest, "utf8"))
    ),
    Effect.map((source) => String(JSON.parse(source).version ?? "")),
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

  const { composition, frame, id } = decoded.value;

  return importFrom<unknown>(booted.root, "@remotion/renderer").pipe(
    Effect.flatMap((module) =>
      captureStill({
        dir: booted.dir,
        onEvent: (event) =>
          Effect.runSync(write({ event, id, type: "still-progress" })),
        renderer: rendererOf(module),
        request: { composition, frame },
        serveUrl: booted.serveUrl,
      })
    ),
    Effect.flatMap((still) => write({ id, still, type: "still-done" })),
    Effect.catch((error) =>
      Effect.andThen(
        log(`preview still failed: ${error.message}`),
        write({ id, message: error.message, type: "still-failed" })
      )
    )
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
