import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit, type Scope } from "effect";
import type { BuildOutcome } from "./build-state";
import { messagesOf, nativeBundle } from "./native";
import type { WebpackConfig } from "./project";

type Compile = Parameters<typeof nativeBundle>[0];
type NativeOptions = Parameters<typeof nativeBundle>[2];

class DefinePlugin {
  definitions: Record<string, string>;
  constructor(definitions: Record<string, string>) {
    this.definitions = definitions;
  }
}
class LimitChunkCountPlugin {
  options: { maxChunks: number };
  constructor(options: { maxChunks: number }) {
    this.options = options;
  }
}
class ReactFreshWebpackPlugin {}
class HotModuleReplacementPlugin {}
class ProgressPlugin {}
class MiniCssExtractPlugin {}
class CaseSensitivePathsPlugin {}

const CSS_TEST = /\.css$/;

function stats(ok: boolean, messages: string[] = []) {
  return {
    hasErrors: () => !ok,
    toJson: () => ({
      errors: ok ? [] : messages.map((message) => ({ message })),
    }),
  };
}

function fakeCompile() {
  const calls: WebpackConfig[] = [];
  const closed: number[] = [];
  const watched: unknown[] = [];
  let done:
    | ((error: Error | null, result?: ReturnType<typeof stats>) => void)
    | null = null;
  const compile = ((config: WebpackConfig) => {
    calls.push(config);
    return {
      watch: (options: unknown, callback: NonNullable<typeof done>) => {
        watched.push(options);
        done = callback;
        callback(null, stats(true));
        return {
          close: (finished: () => void) => {
            closed.push(calls.length);
            finished();
          },
        };
      },
    };
  }) as unknown as Compile;
  Object.assign(compile, {
    DefinePlugin,
    optimize: { LimitChunkCountPlugin },
  });
  return {
    calls,
    closed,
    compile,
    fire: (ok: boolean, messages?: string[]) =>
      done?.(null, stats(ok, messages)),
    watched,
  };
}

// What webpack wrote: the fake compiler reports done, and the bundle is read
// from here exactly as it is from the real output directory.
const OUT = mkdtempSync(path.join(tmpdir(), "remocn-native-"));
const SCRIPT = path.join(OUT, "bundle.js");

beforeEach(() => {
  writeFileSync(SCRIPT, "the first build");
});

afterAll(() => {
  rmSync(OUT, { force: true, recursive: true });
});

function text(script: Uint8Array | undefined): string {
  return new TextDecoder().decode(script);
}

const PREVIEW_ENTRY = "/app/resources/preview/entry.tsx";
const PREVIEW_DIR = path.dirname(PREVIEW_ENTRY);
const PROJECT_ENTRY = "/project/src/index.ts";

function baseOptions(overrides: Partial<NativeOptions> = {}): NativeOptions {
  return {
    assets: "http://127.0.0.1:4000/preview",
    base: "/native-abc123",
    directory: OUT,
    entry: PREVIEW_ENTRY,
    origin: "http://127.0.0.1:4000",
    projectEntry: PROJECT_ENTRY,
    rebuilt: () => undefined,
    ...overrides,
  };
}

function baseConfig(overrides: Partial<WebpackConfig> = {}): WebpackConfig {
  return {
    entry: [
      "/r/node_modules/@remotion/bundler/dist/setup-sequence-stack-traces.js",
      "/r/node_modules/@remotion/bundler/dist/setup-environment.js",
    ],
    experiments: { lazyCompilation: true },
    module: {
      rules: [
        { test: CSS_TEST, use: ["style-loader", "css-loader"] },
        {
          oneOf: [
            { use: [{ loader: "fast-refresh/loader.js" }, "css-loader"] },
          ],
        },
      ],
    },
    output: { path: "/render-out" },
    plugins: [
      new ReactFreshWebpackPlugin(),
      new HotModuleReplacementPlugin(),
      new ProgressPlugin(),
      new CaseSensitivePathsPlugin(),
    ],
    resolve: {
      alias: { remotion: "/r/node_modules/remotion/dist/index.js" },
    },
    ...overrides,
  };
}

function run<A, E>(effect: Effect.Effect<A, E, Scope.Scope>) {
  return Effect.runPromise(Effect.scoped(effect));
}

function firstConfig(calls: WebpackConfig[]): WebpackConfig {
  const [config] = calls;
  if (!config) {
    throw new Error("the fake compiler was never called");
  }
  return config;
}

describe("messagesOf", () => {
  it("joins every error message with a blank line", () => {
    const message = messagesOf(
      stats(false, ["first problem", "second problem"])
    );
    expect(message).toBe("first problem\n\nsecond problem");
  });

  it("falls back to a generic message when the stats carry nothing readable", () => {
    expect(messagesOf(stats(false, []))).toBe("the project failed to compile");
  });
});

describe("nativeBundle", () => {
  it("rebuilds from a cache kept in memory, watching with the project's own options", async () => {
    const { calls, compile, watched } = fakeCompile();
    const watchOptions = {
      aggregateTimeout: 0,
      ignored: ["**/.git/**", "**/.turbo/**", "**/node_modules/**"],
    };

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig({ cache: false, watchOptions })),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    expect(firstConfig(calls).cache).toEqual({
      maxGenerations: 1,
      type: "memory",
    });
    expect(watched).toEqual([watchOptions]);
  });

  it("appends the project's entry and the native runtime after the stack-trace setup", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    expect(firstConfig(calls).entry).toEqual([
      "/r/node_modules/@remotion/bundler/dist/setup-sequence-stack-traces.js",
      PROJECT_ENTRY,
      path.join(PREVIEW_DIR, "native-entry.tsx"),
    ]);
  });

  it("drops React Refresh, HMR and progress plugins and adds its own", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    const names = (
      firstConfig(calls).plugins as { constructor: { name: string } }[]
    ).map((plugin) => plugin.constructor.name);
    expect(names).toEqual([
      "CaseSensitivePathsPlugin",
      "DefinePlugin",
      "LimitChunkCountPlugin",
    ]);
  });

  it("carries extra plugins the caller supplies after its own", async () => {
    const { calls, compile } = fakeCompile();
    class ExtraPlugin {}

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions({ plugins: [new ExtraPlugin()] })
        );
        yield* bundle.prepare;
      })
    );

    const names = (
      firstConfig(calls).plugins as { constructor: { name: string } }[]
    ).map((plugin) => plugin.constructor.name);
    expect(names.at(-1)).toBe("ExtraPlugin");
  });

  it("scopes style-loader to the ShadowRoot and drops the fast-refresh loader", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    const dumped = JSON.stringify(firstConfig(calls).module);
    expect(dumped).not.toContain("fast-refresh");
    expect(dumped).toContain(path.join(PREVIEW_DIR, "native-style.ts"));
  });

  it("routes the studio-objects-v5 provider through the managed loader", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    const modules = firstConfig(calls).module as {
      rules: Record<string, unknown>[];
    };
    const managed = modules.rules.find(
      (rule) =>
        rule.test instanceof RegExp &&
        rule.test.test("/r/src/studio-objects-v7/index.tsx")
    ) as {
      test: RegExp;
      use: { loader: string; options: { transport: string } }[];
    };
    expect(managed.test.test("/r/src/studio-objects-v5/index.tsx")).toBe(true);
    expect(managed.test.test("/r/src/studio-objects-v7/index.tsx")).toBe(true);
    expect(managed.test.test("/r/src/studio-objects-v6/index.tsx")).toBe(false);
    expect(managed.use[0]?.loader).toBe(
      path.join(PREVIEW_DIR, "managed-loader.cjs")
    );
    expect(managed.use[0].options.transport).toBe(
      path.join(PREVIEW_DIR, "managed-transport.ts")
    );
    const precision = modules.rules.find(
      (rule) =>
        rule.test instanceof RegExp &&
        rule.test.test("/r/src/lib/studio-shaders-v1/caustics-fragment.ts")
    ) as { test: RegExp; use: string[]; enforce: string };
    expect(precision.enforce).toBe("pre");
    expect(precision.use).toEqual([
      path.join(PREVIEW_DIR, "shader-precision-loader.cjs"),
    ]);
    expect(
      precision.test.test("/r/src/lib/studio-shaders-v1/strata-fragment.ts")
    ).toBe(true);
    expect(
      precision.test.test(
        "C:\\project\\src\\lib\\studio-shaders-v1\\weave-fragment.ts"
      )
    ).toBe(true);
    expect(precision.test.test("/r/src/custom/caustics-fragment.ts")).toBe(
      false
    );
    expect(
      precision.test.test("/r/src/lib/studio-shaders-v1/tunnel-renderer.ts")
    ).toBe(false);
  });

  it("aliases remotion to the native shim and keeps the project's own reachable", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    const { alias } = firstConfig(calls).resolve as {
      alias: Record<string, string>;
    };
    expect(alias.remotion$).toBe(path.join(PREVIEW_DIR, "native-remotion.ts"));
    expect(alias.__remocn_project_remotion$).toBe(
      "/r/node_modules/remotion/dist/index.js"
    );
  });

  it("builds one bundle.js window library the manifest can address", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    const output = firstConfig(calls).output as Record<string, unknown>;
    expect(output.filename).toBe("bundle.js");
    expect(output.library).toEqual({
      name: "__remocnNativeBundle",
      type: "window",
    });
    expect(output.publicPath).toBe("http://127.0.0.1:4000/native-abc123/");
    expect(output.chunkLoadingGlobal).toBe("remocn_native_native_abc123");
  });

  it("fails rather than compiling a project with no Remotion alias", async () => {
    const { compile } = fakeCompile();

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const bundle = yield* nativeBundle(
            compile,
            Effect.succeed(baseConfig({ resolve: { alias: {} } })),
            baseOptions()
          );
          yield* bundle.prepare;
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("Remotion module alias");
    }
  });

  it("refuses a project whose styles are extracted rather than injected", async () => {
    const { compile } = fakeCompile();

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const bundle = yield* nativeBundle(
            compile,
            Effect.succeed(
              baseConfig({
                plugins: [new MiniCssExtractPlugin()],
              })
            ),
            baseOptions()
          );
          yield* bundle.prepare;
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("style-loader");
    }
  });

  it("compiles the project once even when prepare is awaited more than once", async () => {
    const { calls, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
        yield* bundle.prepare;
        yield* bundle.start;
      })
    );

    expect(calls.length).toBe(1);
  });

  it("reports every rebuild to the caller and bumps the generation", async () => {
    const { compile, fire } = fakeCompile();
    const outcomes: BuildOutcome[] = [];
    const rebuilds = { count: 0 };

    const [first, second] = await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions({
            compiled: (outcome) => outcomes.push(outcome),
            rebuilt: () => {
              rebuilds.count += 1;
            },
          })
        );
        const generation1 = yield* bundle.prepare;
        fire(true);
        const generation2 = yield* bundle.prepare;
        return [generation1, generation2];
      })
    );

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(rebuilds.count).toBe(2);
    expect(outcomes).toEqual([{ ok: true }, { ok: true }]);
  });

  it("keeps each build as webpack finished writing it, whatever the file holds later", async () => {
    const { compile, fire } = fakeCompile();

    const [first, later, second] = await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
        const kept = bundle.script();
        writeFileSync(SCRIPT, "the second bu");
        const meanwhile = bundle.script();
        writeFileSync(SCRIPT, "the second build");
        fire(true);
        return [kept, meanwhile, bundle.script()];
      })
    );

    expect(first?.generation).toBe(1);
    expect(text(first?.script)).toBe("the first build");
    expect(later).toBe(first);
    expect(second?.generation).toBe(2);
    expect(text(second?.script)).toBe("the second build");
  });

  it("keeps the last build that compiled through a failed rebuild", async () => {
    const { compile, fire } = fakeCompile();

    const [before, after] = await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
        const kept = bundle.script();
        fire(false, ["it broke"]);
        return [kept, bundle.script()];
      })
    );

    expect(after).toBe(before);
    expect(text(after?.script)).toBe("the first build");
  });

  it("fails prepare when the bundle a compile reported cannot be read", async () => {
    const { compile } = fakeCompile();
    const outcomes: BuildOutcome[] = [];

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const bundle = yield* nativeBundle(
            compile,
            Effect.succeed(baseConfig()),
            baseOptions({
              compiled: (outcome) => outcomes.push(outcome),
              directory: path.join(OUT, "missing"),
            })
          );
          yield* bundle.prepare;
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(outcomes[0]?.ok).toBe(false);
  });

  it("fails prepare with the compiler's own message when the first compile fails", async () => {
    const compile = ((_config: WebpackConfig) => ({
      watch: (
        _options: unknown,
        callback: (
          error: Error | null,
          result?: ReturnType<typeof stats>
        ) => void
      ) => {
        callback(null, stats(false, ["it broke"]));
        return { close: (finished: () => void) => finished() };
      },
    })) as unknown as Compile;
    Object.assign(compile, {
      DefinePlugin,
      optimize: { LimitChunkCountPlugin },
    });
    const outcomes: BuildOutcome[] = [];

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const bundle = yield* nativeBundle(
            compile,
            Effect.succeed(baseConfig()),
            baseOptions({ compiled: (outcome) => outcomes.push(outcome) })
          );
          yield* bundle.prepare;
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(outcomes).toEqual([{ message: "it broke", ok: false }]);
  });

  it("closes the watcher once its scope releases", async () => {
    const { closed, compile } = fakeCompile();

    await run(
      Effect.gen(function* () {
        const bundle = yield* nativeBundle(
          compile,
          Effect.succeed(baseConfig()),
          baseOptions()
        );
        yield* bundle.prepare;
      })
    );

    expect(closed).toEqual([1]);
  });
});
