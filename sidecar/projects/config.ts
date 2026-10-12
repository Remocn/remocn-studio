// biome-ignore-all lint/style/useErrorCause: Effect Schema errors take cause in their field record, not a second ErrorOptions argument.
import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { brandFiles, type ProjectBrand } from "@/shared/brand";
import {
  ProjectConfig,
  type ProjectSettingsDraft,
  ProjectSettingsError,
} from "@/shared/project-config";
import { remotionRootOf } from "../preview/project";

const decode = Schema.decodeUnknownSync(ProjectConfig);
const pending = new Map<string, Promise<unknown>>();
export const configPath = (root: string) =>
  join(root, ".remocn", "project.json");
export const hashBytes = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export const configEffect = <A>(work: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof ProjectSettingsError
        ? cause
        : new ProjectSettingsError({
            code: "io",
            message: errorMessage(cause),
          }),
    try: work,
  });

export async function serialized<A>(
  root: string,
  work: () => Promise<A>
): Promise<A> {
  const key = await realpath(root);
  const before = pending.get(key) ?? Promise.resolve();
  const next = before.catch(() => undefined).then(work);
  pending.set(key, next);
  try {
    return await next;
  } finally {
    if (pending.get(key) === next) {
      pending.delete(key);
    }
  }
}

export async function contained(root: string, path: string): Promise<string> {
  if (isAbsolute(path) || path.split(PATTERN_1).includes("..")) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: `Unsafe project path: ${path}`,
    });
  }
  const base = await realpath(root);
  const target = resolve(base, path);
  await rejectLinks(base, target, path);
  let cursor = target;
  for (;;) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Each ancestor depends on the missing child path.
      const actual = await realpath(cursor);
      const rel = relative(base, actual);
      if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
        throw new ProjectSettingsError({
          code: "invalid-file",
          message: `Path leaves the project: ${path}`,
        });
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      const parent = dirname(cursor);
      if (parent === cursor) {
        throw error;
      }
      cursor = parent;
    }
  }
  return target;
}

export async function atomicJson(
  root: string,
  path: string,
  value: unknown
): Promise<void> {
  const target = await contained(root, path);
  await mkdir(dirname(target), { recursive: true });
  await contained(root, path);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function readManifest(
  root: string
): Promise<ProjectConfig | null> {
  try {
    await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  const path = await contained(root, ".remocn/project.json");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  try {
    return decode(JSON.parse(text));
  } catch (cause) {
    throw new ProjectSettingsError({
      cause,
      code: "invalid-config",
      message: `Cannot read ${path}: ${errorMessage(cause)}`,
    });
  }
}

export async function getConfig(project: {
  id: string;
  path: string;
  name: string;
}): Promise<ProjectConfig> {
  const config = await readManifest(project.path);
  if (config !== null && config.projectId !== project.id) {
    throw new ProjectSettingsError({
      code: "identity-conflict",
      message: "The folder belongs to a different project. Open it separately.",
    });
  }
  return (
    config ?? {
      brand: null,
      name: project.name,
      projectId: project.id,
      revision: 0,
      schemaVersion: 1,
    }
  );
}

export async function validateBrand(
  root: string,
  brand: ProjectBrand | null
): Promise<void> {
  if (
    brand?.design &&
    hashBytes(brand.design.markdown) !== brand.design.file.hash
  ) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: "The DESIGN.md contents do not match the imported file.",
    });
  }
  const managed = relative(root, join(remotionRootOf(root), "public", "brand"))
    .split(sep)
    .join("/");
  for (const file of brandFiles(brand)) {
    if (!file.path.startsWith(`${managed}/${file.hash}/`)) {
      throw new ProjectSettingsError({
        code: "invalid-file",
        message: `Brand file is outside its content-addressed folder: ${file.path}`,
      });
    }
    // biome-ignore lint/performance/noAwaitInLoops: Bound memory while checking potentially large font files.
    const path = await contained(root, file.path);
    if (
      !(await lstat(path)).isFile() ||
      hashBytes(await readFile(path)) !== file.hash
    ) {
      throw new ProjectSettingsError({
        code: "invalid-file",
        message: `Brand file is missing or changed: ${file.path}`,
      });
    }
  }
}

export function saveConfig(
  project: { id: string; path: string; name: string },
  draft: ProjectSettingsDraft
): Promise<ProjectConfig> {
  return serialized(project.path, () =>
    withConfigLock(project.path, async () => {
      const previous = await getConfig(project);
      if (draft.projectId !== project.id) {
        throw new ProjectSettingsError({
          code: "identity-conflict",
          message: "This draft belongs to another project.",
        });
      }
      if (
        previous.revision === draft.expectedRevision + 1 &&
        previous.name === draft.name.trim() &&
        JSON.stringify(previous.brand) === JSON.stringify(draft.brand)
      ) {
        return previous;
      }
      if (previous.revision !== draft.expectedRevision) {
        throw new ProjectSettingsError({
          code: "revision-conflict",
          message:
            "Project settings changed elsewhere. Reload before saving your changes.",
        });
      }
      const next = decode({
        ...previous,
        brand: draft.brand,
        name: draft.name.trim(),
        revision: previous.revision + 1,
      });
      await validateBrand(project.path, next.brand);
      if (
        previous.name === next.name &&
        JSON.stringify(previous.brand) === JSON.stringify(next.brand) &&
        (await readManifest(project.path)) !== null
      ) {
        return previous;
      }
      await atomicJson(project.path, ".remocn/project.json", next);
      return next;
    })
  );
}

const PATTERN_1 = /[\\/]/;

const decodeLock = Schema.decodeUnknownSync(
  Schema.Struct({ host: Schema.String, pid: Schema.Int })
);
async function acquireConfigLock(root: string, retry = true): Promise<string> {
  const directory = await contained(root, ".remocn");
  await mkdir(directory, { recursive: true });
  const path = await contained(root, ".remocn/settings.lock");
  const temporary = `${path}.${randomUUID()}`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(
      JSON.stringify({ host: hostname(), pid: process.pid })
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, path);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "EEXIST") {
      throw cause;
    }
    const owner = decodeLock(JSON.parse(await readFile(path, "utf8")));
    let abandoned = false;
    if (owner.host === hostname() && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        abandoned = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
    }
    if (abandoned && retry) {
      await unlink(path);
      return acquireConfigLock(root, false);
    }
    throw new ProjectSettingsError({
      cause,
      code: "busy",
      message:
        "Another Studio process is saving this project's settings. Try again when it finishes.",
    });
  } finally {
    await unlink(temporary);
  }
  return path;
}
export async function withConfigLock<A>(
  root: string,
  work: () => Promise<A>
): Promise<A> {
  const path = await acquireConfigLock(root);
  try {
    return await work();
  } finally {
    await unlink(path);
  }
}

async function rejectLinks(
  base: string,
  target: string,
  path: string
): Promise<void> {
  let segmentPath = base;
  for (const segment of relative(base, target).split(sep)) {
    segmentPath = join(segmentPath, segment);
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Walk each managed path segment before following its children.
      const info = await lstat(segmentPath);
      if (info.isSymbolicLink()) {
        throw new ProjectSettingsError({
          code: "invalid-file",
          message: `A symlink leaves the project managed area: ${path}`,
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
}

export function hashSources(sources: Readonly<Record<string, string>>) {
  return hashBytes(
    JSON.stringify(
      Object.entries(sources).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    )
  );
}
