import { randomBytes } from "node:crypto";
import path from "node:path";
import { Effect } from "effect";
import { PREVIEW_ENTRY_ENV, type PreviewEvent } from "@/shared/ipc";
import { untilGone, untilOrphaned, untilSignalled } from "../lifecycle";
import {
  entryPointOf,
  importFrom,
  PreviewError,
  remotionRootOf,
  resolveFrom,
  type WebpackConfig,
  webpackOverrideOf,
} from "./project";
import { serve } from "./server";

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

const emit = (event: PreviewEvent) =>
  Effect.sync(() => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  });

const log = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`);
  });

export const runPreviewHost: Effect.Effect<void> = Effect.gen(function* () {
  const opened = process.cwd();
  const root = remotionRootOf(opened);

  if (root !== opened) {
    yield* Effect.sync(() => process.chdir(root));
    yield* log(`preview root for ${opened} resolved to ${root}`);
  }

  yield* boot(root).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        log(`preview host failed: ${error.message}`),
        emit({ message: error.message, type: "failed" })
      )
    )
  );

  const reason = yield* Effect.raceAll([
    untilStdinClosed,
    untilSignalled,
    untilGone(PREVIEW_PARENT_ENV),
    untilOrphaned,
  ]);

  yield* log(`preview host stopping: ${reason}`);
}).pipe(Effect.scoped);

function boot(root: string) {
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
    const staticBase = `/static-${randomBytes(6).toString("hex")}`;

    const server = yield* serve({
      outDir,
      publicDir: path.join(root, "public"),
      staticBase,
      title: path.basename(root),
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
            ours(await override(input), playerPath),
        }),
    });

    yield* watch(webpack, config, server.notifyRebuilt, server.port);
  });
}

function ours(config: WebpackConfig, playerPath: string): WebpackConfig {
  const resolve = (config.resolve ?? {}) as Record<string, unknown>;
  const alias = (resolve.alias ?? {}) as Record<string, unknown>;

  return {
    ...config,
    resolve: {
      ...resolve,
      alias: { ...alias, "@remotion/player": playerPath },
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
