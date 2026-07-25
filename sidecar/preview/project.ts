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
    const file = configFile(root);
    if (file !== null) {
      yield* importFile(file);
    }

    const config = yield* importFrom<{
      ConfigInternals: { getWebpackOverrideFn: () => WebpackOverride };
    }>(root, "@remotion/cli/config");

    return config.ConfigInternals.getWebpackOverrideFn();
  });
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
