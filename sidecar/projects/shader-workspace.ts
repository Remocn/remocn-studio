import { constants } from "node:fs";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import {
  ShaderError,
  shaderFailure,
  shaderIO,
  shaderResourcePlan,
} from "../library/shaders";
import {
  ENTRY_CANDIDATES,
  importFrom,
  type WebpackOverride,
  webpackOverrideOf,
} from "../preview/project";
import { contained, hashBytes, hashSources } from "./config";
import { shaderSourceBindings } from "./shader-adaptation";
import { planShaderConnection, readShaderFile } from "./shader-targets";

const TEXT_SOURCE = /\.(?:[cm]?[jt]sx?|json|css|md)$/;

const ROOT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "remotion.config.ts",
  "remotion.config.js",
];
const failed = (cause: { message: string }) =>
  new ShaderError({ message: cause.message });
async function sourceFiles(root: string, folder = "src"): Promise<string[]> {
  const entries = await readdir(await contained(root, folder), {
    withFileTypes: true,
  });
  const lists = await Promise.all(
    entries.map((entry) => {
      const path = `${folder}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new ShaderError({
          message: `${path} is a symbolic link. Prepare this video's shared source manually.`,
        });
      }
      if (entry.isDirectory()) {
        return sourceFiles(root, path);
      }
      return entry.isFile() ? [path] : [];
    })
  );
  return lists.flat().sort();
}
export const preparationSnapshot = (root: string) =>
  shaderIO(async () => {
    const files = [...(await sourceFiles(root)), ...ROOT_FILES];
    const entries = await Promise.all(
      files.map(async (path) => {
        const bytes = await readFile(await contained(root, path)).catch(
          (cause: NodeJS.ErrnoException) => {
            if (cause.code === "ENOENT") {
              return null;
            }
            throw cause;
          }
        );
        return [
          path,
          bytes === null ? hashBytes("absent") : hashBytes(bytes),
        ] as const;
      })
    );
    const hashes = Object.fromEntries(entries);
    return { hashes, revision: hashSources(hashes) };
  });
export const bundlePreparedVideo = Effect.fn("shaderPreparation.bundle")(
  function* (root: string) {
    const bundler = yield* importFrom<{
      bundle: (options: {
        entryPoint: string;
        rootDir: string;
        outDir: string;
        webpackOverride: WebpackOverride;
      }) => Promise<string>;
    }>(root, "@remotion/bundler").pipe(Effect.mapError(failed));
    let entryPoint: string | null = null;
    for (const path of ENTRY_CANDIDATES) {
      if ((yield* readShaderFile(root, path)) !== null) {
        entryPoint = join(root, path);
        break;
      }
    }
    if (!entryPoint) {
      return yield* shaderFailure(
        "The project has no Remotion entry point to validate."
      );
    }
    const webpackOverride = yield* webpackOverrideOf(root).pipe(
      Effect.mapError(failed)
    );
    // The bundler cannot be cancelled. Let it release the copy before cleanup;
    // a pending interruption is observed before any activation can start.
    yield* shaderIO(() =>
      bundler.bundle({
        entryPoint,
        outDir: join(root, ".shader-bundle"),
        rootDir: root,
        webpackOverride,
      })
    ).pipe(Effect.uninterruptible);
  }
);

export function preparationBrief(video: string) {
  return `Prepare src/videos/${video} for scene-local Studio shaders. You are working in a temporary copy. Only change files inside src/videos/${video}/. Preserve every scene, frame timing, transition, visual, audio, and existing studio.json object/value/operation. Do not change studio-origin.json or invent a creation version. Do not add a shader instance. Do not change dependencies, shared libraries or other videos. Do not start servers.

The automatic connector requires ALL of the following:
- Explicit Sequence, Series.Sequence or TransitionSeries.Sequence occurrences, one local scene component per occurrence. Replace dynamic map/lookup schedules with equivalent explicit occurrences. Use statically resolvable frame counts (literals or constant arithmetic); preserve durations, offsets and transition overlaps.
- Each scene must be an explicit function declaration with a single top-level return of an AbsoluteFill imported from remotion. A custom SceneRoot wrapper, even one that renders AbsoluteFill internally, is not recognised. Expand that wrapper at each scene root while preserving its styles, attributes, children and behaviour; do not just replace its tag and lose styling or bindings.
- In that same scene function declare const scene = useStudioObject("<existing scene ID>") and spread {...scene.bind} onto the returned AbsoluteFill. Use the existing active scene ID from studio.json, without creating or renaming objects or adding a second binding for the same ID.
- Preserve the existing v5/v6 StudioObjects provider and all local hooks coherently; Studio upgrades them together and inserts slots after verified opaque backgrounds and before foreground inside each scene's existing timing scope. Preparing these roots is part of this authorised task. Do not stop after only expanding the schedule.

Alternatively connect explicit StudioShaderSlot instances with permanent IDs, a video-local shader-registry.ts and valid studio-shaders.json bindings to all participating source files, using the provided studio-objects-v7 runtime. Keep all provider/hooks on the same version. Read the provided src/lib/studio-objects-v7/README.md. If preserving the video is impossible, explain the limitation and leave the source unchanged. Studio will validate source bindings and compilation after each attempt and may return diagnostics for repair in this same working copy; your final text or a TypeScript check alone is not a success signal.`;
}

export const copyShaderWorkspace = Effect.fn("shaderPreparation.copy")(
  function* (root: string, stage: string, revision: string) {
    const baseline = yield* preparationSnapshot(root);
    yield* shaderIO(async () => {
      await Promise.all(
        ["src", "public", ...ROOT_FILES].map(async (name) => {
          await cp(await contained(root, name), join(stage, name), {
            mode: constants.COPYFILE_FICLONE,
            recursive: true,
          }).catch((cause: NodeJS.ErrnoException) => {
            if (cause.code !== "ENOENT") {
              throw cause;
            }
          });
        })
      );
      await symlink(
        join(root, "node_modules"),
        join(stage, "node_modules"),
        "dir"
      );
    }).pipe(Effect.uninterruptible);
    if ((yield* preparationSnapshot(stage)).revision !== revision) {
      return yield* shaderFailure(
        "The source changed while the working copy was created. Retry preparation."
      );
    }
    const resources = yield* shaderResourcePlan("shader-mesh-gradient");
    for (const file of resources.files) {
      const before = yield* readShaderFile(stage, file.path);
      if (before !== null && before !== file.content) {
        return yield* shaderFailure(
          `${file.path} has authored changes and cannot be replaced.`
        );
      }
      yield* shaderIO(() => replace(stage, file.path, file.content));
    }
    return { baseline, resources, staged: yield* preparationSnapshot(stage) };
  }
);
type Workspace = Effect.Success<ReturnType<typeof copyShaderWorkspace>>;

export const checkAgentWorkspace = Effect.fn("shaderPreparation.checkAgent")(
  function* (stage: string, video: string, workspace: Workspace) {
    const after = yield* preparationSnapshot(stage);
    const prefix = `src/videos/${video}/`;
    for (const path of new Set([
      ...Object.keys(workspace.staged.hashes),
      ...Object.keys(after.hashes),
    ])) {
      if (
        !path.startsWith(prefix) &&
        workspace.staged.hashes[path] !== after.hashes[path]
      ) {
        return yield* shaderFailure(
          `The agent changed ${path} outside this video. The original project was preserved.`
        );
      }
    }
    for (const name of ["studio.json", "studio-origin.json"]) {
      const path = `${prefix}${name}`;
      if (workspace.staged.hashes[path] !== after.hashes[path]) {
        return yield* shaderFailure(
          `${name} changed during preparation. Existing properties and creation metadata must be preserved.`
        );
      }
    }
  }
);

export const connectShaderWorkspace = Effect.fn("shaderPreparation.connect")(
  function* (
    stage: string,
    video: string,
    validate: (root: string) => Effect.Effect<void, ShaderError> = () =>
      Effect.void
  ) {
    const plan = yield* planShaderConnection(stage, video);
    const manifestPath = `src/videos/${video}/studio-shaders.json`;
    const originals = new Map<string, string | null>();
    for (const path of new Set([
      ...plan.edits.map((edit) => edit.path),
      manifestPath,
    ])) {
      originals.set(path, yield* readShaderFile(stage, path));
    }
    return yield* Effect.gen(function* () {
      for (const edit of plan.edits) {
        const content = edit.after;
        if (content !== null && edit.before !== content) {
          yield* shaderIO(() => replace(stage, edit.path, content));
        }
      }
      const sources = {
        ...plan.manifest.sources,
        ...(yield* shaderSourceBindings(stage, `src/videos/${video}`)),
      };
      const manifest = {
        ...plan.manifest,
        sourceRevision: hashSources(sources),
        sources,
      };
      yield* shaderIO(() =>
        replace(
          stage,
          `src/videos/${video}/studio-shaders.json`,
          `${JSON.stringify(manifest, null, 2)}\n`
        )
      );
      const connected = yield* planShaderConnection(stage, video);
      if (
        connected.manifest.slots.length === 0 ||
        connected.manifest.implementations.length !== 0
      ) {
        return yield* shaderFailure(
          "Preparation must connect scene slots without adding shader instances."
        );
      }
      yield* validate(stage);
      return plan;
    }).pipe(
      Effect.onError(() =>
        Effect.forEach(
          [...originals],
          ([path, content]) =>
            shaderIO(async () => {
              if (content === null) {
                await rm(await contained(stage, path), { force: true });
              } else {
                await replace(stage, path, content);
              }
            }),
          { discard: true }
        ).pipe(Effect.orDie)
      )
    );
  }
);

export const shaderWorkspaceEdits = Effect.fn("shaderPreparation.edits")(
  function* (
    root: string,
    stage: string,
    video: string,
    workspace: Workspace,
    plan: Effect.Success<ReturnType<typeof planShaderConnection>>
  ) {
    const after = yield* preparationSnapshot(stage);
    const edits: { after: string; before: string | null; path: string }[] = [];
    for (const path of new Set([
      ...Object.keys(workspace.baseline.hashes),
      ...Object.keys(after.hashes),
    ])) {
      if (workspace.baseline.hashes[path] === after.hashes[path]) {
        continue;
      }
      if (
        !(
          path.startsWith(`src/videos/${video}/`) ||
          workspace.resources.files.some((file) => file.path === path) ||
          plan.edits.some((edit) => edit.path === path)
        )
      ) {
        return yield* shaderFailure(
          `${path} is outside the prepared source plan.`
        );
      }
      if (!TEXT_SOURCE.test(path)) {
        return yield* shaderFailure(
          `Preparation changed the asset ${path}. Only source changes can be activated.`
        );
      }
      const content = yield* readShaderFile(stage, path);
      if (content === null) {
        return yield* shaderFailure(
          `Preparation removed ${path}. The original project was preserved.`
        );
      }
      edits.push({
        after: content,
        before: yield* readShaderFile(root, path),
        path,
      });
    }
    return edits;
  }
);
export async function replace(root: string, path: string, content: string) {
  const target = await contained(root, path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
