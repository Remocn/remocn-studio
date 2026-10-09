import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { ENTRY_CANDIDATES, remotionRootOf } from "../preview/project";
import {
  copyInto,
  REGISTRY_TEMPLATE,
  ScaffoldError,
  VIDEOS_DIR,
} from "./template";

export const REGISTRY_FILE = "registry.tsx";
export const REGISTRY_EXPORT = "withVideos";

const REGISTER = /registerRoot\(\s*([A-Za-z_$][\w$]*)\s*\)/;
const LAST_IMPORT = /^import .*$/gm;
const TSX = /\.tsx$/;

export interface Registered {
  readonly entry: string;
  readonly wrapped: boolean;
}

// A project we did not scaffold has its own Root.tsx, and it is not ours to
// rewrite. The entry point is: three lines of a shape every Remotion project
// shares, so the scan is spliced in there — `registerRoot(withVideos(Root))` —
// and the person's compositions keep rendering exactly as they did.
export function ensureRegistry(
  folder: string
): Effect.Effect<Registered, ScaffoldError> {
  return Effect.suspend(() => {
    const source = process.env[TEMPLATE_DIR_ENV];

    if (source === undefined) {
      return Effect.fail(
        new ScaffoldError({
          message: `${TEMPLATE_DIR_ENV} is not set, so there is no registry to write`,
        })
      );
    }

    const root = remotionRootOf(folder);

    return Effect.tryPromise({
      catch: (cause) =>
        cause instanceof ScaffoldError
          ? cause
          : new ScaffoldError({ message: errorMessage(cause) }),
      try: () => install(source, root),
    });
  });
}

const RUNTIMES = [
  "studio-motion-v1",
  "studio-motion-v2",
  "studio-objects-v1",
  "studio-objects-v2",
  "studio-objects-v3",
  "studio-objects-v4",
  "studio-objects-v5",
  "studio-objects-v6",
  "studio-objects-v7",
] as const;

export type Runtime = (typeof RUNTIMES)[number];

function copyRuntime(source: string, root: string, version: Runtime) {
  const folder = join("src", "lib", version);
  return copyInto(
    join(source, folder),
    join(root, folder),
    () => null,
    () => false
  );
}

export async function installRuntime(
  root: string,
  version: Runtime
): Promise<void> {
  const source = process.env[TEMPLATE_DIR_ENV];
  if (source === undefined) {
    throw new ScaffoldError({
      message: `${TEMPLATE_DIR_ENV} is not set, so there is no runtime to add`,
    });
  }
  await copyRuntime(source, root, version);
}

async function install(source: string, root: string): Promise<Registered> {
  // Versioned, owned resources also reach projects opened before this release.
  // copyInto preserves authored copies, so opening a project cannot change its film.
  await Promise.all(
    RUNTIMES.map((version) => copyRuntime(source, root, version))
  );
  const videos = join(root, "src", VIDEOS_DIR);
  const registry = join(videos, REGISTRY_FILE);
  const shippedRegistry = await readFile(
    join(source, REGISTRY_TEMPLATE),
    "utf8"
  );

  if (await exists(registry)) {
    // Upgrade only the exact old shipped file, never a person's authored copy.
    const oldRegistry = shippedRegistry.replace(
      "withVideos(Root: ComponentType) {",
      "withVideos(Root: ComponentType): ComponentType {"
    );
    if (
      oldRegistry !== shippedRegistry &&
      (await readFile(registry, "utf8")) === oldRegistry
    ) {
      await writeFile(registry, shippedRegistry, "utf8");
    }
  } else {
    await mkdir(videos, { recursive: true });
    await writeFile(registry, shippedRegistry, "utf8");
  }

  const entry = await entryOf(root);
  const before = await readFile(entry, "utf8");
  const after = wrapped(before, importOf(entry, registry));

  if (after === null) {
    return { entry, wrapped: false };
  }

  await writeFile(entry, after, "utf8");
  return { entry, wrapped: true };
}

async function entryOf(root: string): Promise<string> {
  const found = await Promise.all(
    ENTRY_CANDIDATES.map(async (candidate) => {
      const file = join(root, candidate);
      return (await exists(file)) ? file : null;
    })
  );

  // The order of ENTRY_CANDIDATES is the precedence Remotion's own CLI uses,
  // so the first that exists is the entry — not whichever answered first.
  const entry = found.find((file) => file !== null);

  if (entry === undefined) {
    throw new ScaffoldError({
      message: `no Remotion entry point in ${root} — expected one of ${ENTRY_CANDIDATES.join(", ")}`,
    });
  }

  return entry;
}

// Null means the entry already registers the scan. Anything the transform
// cannot recognise is refused by name rather than rewritten on a guess — the
// entry point is the person's file, and a half-understood edit to it would
// break every composition in the project, not just ours.
export function wrapped(source: string, specifier: string): string | null {
  if (source.includes(specifier)) {
    return null;
  }

  const call = REGISTER.exec(source);
  const imports = [...source.matchAll(LAST_IMPORT)];
  const last = imports.at(-1);

  if (call === null || last?.index === undefined) {
    throw new ScaffoldError({
      message:
        "this project's entry point does not call registerRoot(Root) in a shape the studio can extend — register the video in it by hand, or ask the agent to",
    });
  }

  const [, registered] = call;

  const at = last.index + last[0].length;
  const line = `\nimport { ${REGISTRY_EXPORT} } from "${specifier}";`;

  return (
    source.slice(0, at) +
    line +
    source
      .slice(at)
      .replace(REGISTER, `registerRoot(${REGISTRY_EXPORT}(${registered}))`)
  );
}

export function importOf(entry: string, registry: string): string {
  const path = relative(dirname(entry), registry)
    .split(sep)
    .join("/")
    .replace(TSX, "");

  return path.startsWith(".") ? path : `./${path}`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
