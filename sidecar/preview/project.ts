import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";

export class PreviewError extends Data.TaggedError("PreviewError")<{
  message: string;
}> {}

export const CONFIG_FILES = ["remotion.config.ts", "remotion.config.js"];

export const ENTRY_CANDIDATES = [
  "src/index.ts",
  "src/index.tsx",
  "src/index.js",
  "src/index.mjs",
  "remotion/index.tsx",
  "remotion/index.ts",
  "remotion/index.js",
  "remotion/index.mjs",
  "src/remotion/index.tsx",
  "src/remotion/index.ts",
  "src/remotion/index.js",
  "src/remotion/index.mjs",
];

export type WebpackConfig = Record<string, unknown>;

export type WebpackOverride = (
  config: WebpackConfig
) => WebpackConfig | Promise<WebpackConfig>;

const missing = (root: string, specifier: string) =>
  new PreviewError({
    message: `${specifier} is not installed in ${root} — run bun install in the project folder`,
  });

export function resolveFrom(
  root: string,
  specifier: string
): Effect.Effect<string, PreviewError> {
  return Effect.try({
    catch: () => missing(root, specifier),
    try: () =>
      createRequire(path.join(root, "package.json")).resolve(specifier),
  });
}

export function importFrom<A>(
  root: string,
  specifier: string
): Effect.Effect<A, PreviewError> {
  return Effect.flatMap(resolveFrom(root, specifier), (resolved) =>
    importFile<A>(resolved)
  );
}

export function importFile<A>(file: string): Effect.Effect<A, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) => new PreviewError({ message: errorMessage(cause) }),
    try: () => import(pathToFileURL(file).href) as Promise<A>,
  });
}

export function remotionRootOf(folder: string): string {
  let dir = folder;

  for (;;) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return folder;
    }

    dir = parent;
  }
}

export function configFile(root: string): string | null {
  const found = CONFIG_FILES.map((name) => path.join(root, name)).find((file) =>
    existsSync(file)
  );
  return found ?? null;
}

export function webpackOverrideOf(
  root: string
): Effect.Effect<WebpackOverride, PreviewError> {
  return Effect.gen(function* () {
    yield* loadConfig(root);

    const config = yield* importFrom<{
      ConfigInternals: { getWebpackOverrideFn: () => WebpackOverride };
    }>(root, "@remotion/cli/config");

    return config.ConfigInternals.getWebpackOverrideFn();
  });
}

function loadConfig(root: string): Effect.Effect<void, PreviewError> {
  const file = configFile(root);
  return file === null ? Effect.void : Effect.asVoid(importFile(file));
}

export interface RenderOptions {
  chromeMode: string | null;
  chromiumOptions: Record<string, unknown>;
  timeoutInMilliseconds: number | null;
}

interface RemotionOption {
  getValue: (input: { commandLine: Record<string, unknown> }) => {
    source: string;
    value: unknown;
  };
}

const CHROMIUM_OPTIONS: Record<string, [string, string]> = {
  darkMode: ["dark-mode", "darkModeOption"],
  disableWebSecurity: ["disable-web-security", "disableWebSecurityOption"],
  enableMultiProcessOnLinux: [
    "enable-multiprocess-on-linux",
    "enableMultiprocessOnLinuxOption",
  ],
  gl: ["gl", "glOption"],
  headless: ["headless", "headlessOption"],
  ignoreCertificateErrors: [
    "ignore-certificate-errors",
    "ignoreCertificateErrorsOption",
  ],
  userAgent: ["user-agent", "userAgentOption"],
};

export function renderOptionsOf(
  root: string
): Effect.Effect<RenderOptions, PreviewError> {
  return Effect.gen(function* () {
    yield* loadConfig(root);

    const manifest = yield* resolveFrom(
      root,
      "@remotion/renderer/package.json"
    );
    const options = path.join(path.dirname(manifest), "dist/options");

    const read = (file: string, name: string) =>
      importFile<Record<string, unknown>>(
        path.join(options, `${file}.js`)
      ).pipe(
        Effect.map((module) => configured(module, name)),
        Effect.catch(() => Effect.succeed(null))
      );

    const chromiumOptions: Record<string, unknown> = {};

    for (const [key, [file, name]] of Object.entries(CHROMIUM_OPTIONS)) {
      const value = yield* read(file, name);
      if (value !== null) {
        chromiumOptions[key] = value;
      }
    }

    const timeout = yield* read(
      "timeout",
      "delayRenderTimeoutInMillisecondsOption"
    );

    return {
      chromeMode: asString(yield* read("chrome-mode", "chromeModeOption")),
      chromiumOptions,
      timeoutInMilliseconds: typeof timeout === "number" ? timeout : null,
    };
  });
}

function configured(module: Record<string, unknown>, name: string): unknown {
  const found = module as { default?: Record<string, unknown> };
  const option = (module[name] ?? found.default?.[name]) as
    | RemotionOption
    | undefined;

  return option === undefined
    ? null
    : (option.getValue({ commandLine: {} }).value ?? null);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function entryPointOf(
  root: string
): Effect.Effect<string, PreviewError> {
  return fromRemotion(root).pipe(
    Effect.catch(() => Effect.succeed(fromCandidates(root))),
    Effect.flatMap((file) =>
      file === null
        ? Effect.fail(
            new PreviewError({
              message: `no Remotion entry point in ${root} — expected one of ${ENTRY_CANDIDATES.join(", ")}, or setEntryPoint() in remotion.config.ts`,
            })
          )
        : Effect.succeed(file)
    )
  );
}

function fromRemotion(
  root: string
): Effect.Effect<string | null, PreviewError> {
  return Effect.gen(function* () {
    const manifest = yield* resolveFrom(root, "@remotion/cli/package.json");
    const module = yield* importFile<{
      findEntryPoint: (input: {
        allowDirectory: boolean;
        args: string[];
        logLevel: string;
        remotionRoot: string;
      }) => { file: string | null };
    }>(path.join(path.dirname(manifest), "dist/entry-point.js"));

    return module.findEntryPoint({
      allowDirectory: false,
      args: [],
      logLevel: "error",
      remotionRoot: root,
    }).file;
  });
}

function fromCandidates(root: string): string | null {
  const found = ENTRY_CANDIDATES.map((candidate) =>
    path.join(root, candidate)
  ).find((file) => existsSync(file));
  return found ?? null;
}
