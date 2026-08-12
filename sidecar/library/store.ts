import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Clock, Data, Effect, Exit, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { DATA_DIR_ENV, LIBRARY_DIR_ENV } from "@/shared/ipc";
import {
  type Asset,
  type AssetDraft,
  AssetManifest,
  slugOf,
} from "@/shared/library";

export class LibraryError extends Data.TaggedError("LibraryError")<{
  message: string;
}> {}

export const ASSETS = "assets";
export const MANIFEST = "manifest.json";
export const PREVIEW = "preview.png";
export const PROXY = "proxy.mp4";
export const CLIP = "preview.mp4";

const DISMISSED = "dismissed.json";
const FALLBACK = "library";

const decodeManifest = Schema.decodeUnknownExit(AssetManifest);

const failed = (cause: unknown) =>
  new LibraryError({ message: errorMessage(cause) });

function attempt<A>(run: () => Promise<A>): Effect.Effect<A, LibraryError> {
  return Effect.tryPromise({ catch: failed, try: run });
}

export function libraryRoot(): string {
  const dir =
    process.env[LIBRARY_DIR_ENV] ??
    join(
      process.env[DATA_DIR_ENV] ?? join(tmpdir(), "remocn-studio"),
      FALLBACK
    );

  mkdirSync(join(dir, ASSETS), { recursive: true });
  return dir;
}

export function listAssets(): Effect.Effect<readonly Asset[], LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS);
    const entries = await readdir(dir, { withFileTypes: true });

    const found = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => assetIn(dir, entry.name))
    );

    return found
      .filter((asset): asset is Asset => asset !== null)
      .sort((one, other) => other.createdAt - one.createdAt);
  });
}

export function findAsset(
  slug: string
): Effect.Effect<Asset | null, LibraryError> {
  return attempt(() => assetIn(join(libraryRoot(), ASSETS), slug));
}

export function saveAsset(
  draft: AssetDraft
): Effect.Effect<Asset, LibraryError> {
  return Effect.gen(function* () {
    if (draft.files.length === 0) {
      return yield* Effect.fail(
        new LibraryError({ message: "an asset needs at least one file" })
      );
    }

    const now = yield* Clock.currentTimeMillis;

    return yield* attempt(() => write(draft, now));
  });
}

export function renameAsset(
  slug: string,
  name: string
): Effect.Effect<Asset, LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS);
    const manifest = await manifestIn(dir, slug);

    if (manifest === null) {
      throw new Error(`there is no asset called ${slug} in the library`);
    }

    await writeFile(
      join(dir, slug, MANIFEST),
      stringify({ ...manifest, name }),
      "utf8"
    );

    const saved = await assetIn(dir, slug);
    if (saved === null) {
      throw new Error(`${slug} could not be read back after renaming`);
    }
    return saved;
  });
}

export function removeAsset(
  slug: string
): Effect.Effect<boolean, LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS, slug);

    if (!existsSync(join(dir, MANIFEST))) {
      return false;
    }

    await rm(dir, { force: true, recursive: true });
    return true;
  });
}

export function attachPreview(
  slug: string,
  from: string,
  duration: number | null = null
): Effect.Effect<Asset, LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS);
    const manifest = await manifestIn(dir, slug);

    if (manifest === null) {
      throw new Error(`there is no asset called ${slug} in the library`);
    }

    await copyFile(from, join(dir, slug, PREVIEW));
    await writeFile(
      join(dir, slug, MANIFEST),
      stringify({
        ...manifest,
        duration: duration ?? manifest.duration,
        preview: PREVIEW,
      }),
      "utf8"
    );

    const saved = await assetIn(dir, slug);
    if (saved === null) {
      throw new Error(`${slug} could not be read back after its preview`);
    }
    return saved;
  });
}

// The clip is pure decoration for the hover preview: it lives beside the
// manifest without being named in it — assetOf finds it on disk — so filing
// one never rewrites anything and a failure costs only the hover.
export function attachClip(
  slug: string,
  from: string
): Effect.Effect<Asset, LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS);

    if (!existsSync(join(dir, slug, MANIFEST))) {
      throw new Error(`there is no asset called ${slug} in the library`);
    }

    await copyFile(from, join(dir, slug, CLIP));

    const saved = await assetIn(dir, slug);
    if (saved === null) {
      throw new Error(`${slug} could not be read back after its clip`);
    }
    return saved;
  });
}

// A proxy is decoration in the same sense a still is: `from` being null records
// the decision that this asset does not need one, so the webview stops measuring
// it on every listing. Either way the asset is untouched — the preview streams
// the proxy, the export never does.
export function attachProxy(
  slug: string,
  from: string | null
): Effect.Effect<Asset, LibraryError> {
  return attempt(async () => {
    const dir = join(libraryRoot(), ASSETS);
    const manifest = await manifestIn(dir, slug);

    if (manifest === null) {
      throw new Error(`there is no asset called ${slug} in the library`);
    }

    if (from !== null) {
      await copyFile(from, join(dir, slug, PROXY));
    }

    await writeFile(
      join(dir, slug, MANIFEST),
      stringify({
        ...manifest,
        proxied: true,
        proxy: from === null ? manifest.proxy : PROXY,
      }),
      "utf8"
    );

    const saved = await assetIn(dir, slug);
    if (saved === null) {
      throw new Error(`${slug} could not be read back after its proxy`);
    }
    return saved;
  });
}

export function unofferedFrom(
  paths: readonly string[]
): Effect.Effect<readonly string[], LibraryError> {
  return attempt(async () => {
    const known = await knownHashes();

    const hashed = await Promise.all(
      paths.map(async (path) => ({ hash: await hashOf(path), path }))
    );

    const seen = new Set<string>();

    return hashed
      .filter((item) => {
        if (item.hash === null || known.has(item.hash) || seen.has(item.hash)) {
          return false;
        }
        seen.add(item.hash);
        return true;
      })
      .map((item) => item.path);
  });
}

export function dismissPaths(
  paths: readonly string[]
): Effect.Effect<number, LibraryError> {
  return attempt(async () => {
    const root = libraryRoot();
    const held = await dismissedHashes(root);
    const before = held.size;

    for (const hash of await Promise.all(paths.map(hashOf))) {
      if (hash !== null) {
        held.add(hash);
      }
    }

    await writeFile(
      join(root, DISMISSED),
      stringify({ hashes: [...held] }),
      "utf8"
    );

    return held.size - before;
  });
}

export function layoutOf(files: readonly string[]): {
  base: string;
  names: readonly string[];
} {
  const absolute = files.map((file) => resolve(file));
  const base = commonDir(absolute);

  return {
    base,
    names: absolute.map((file) => relative(base, file).split(sep).join("/")),
  };
}

async function write(draft: AssetDraft, now: number): Promise<Asset> {
  const dir = join(libraryRoot(), ASSETS);
  const slug = freeSlug(dir, slugOf(draft.name));
  const target = join(dir, slug);
  const { base, names } = layoutOf(draft.files);

  await mkdir(target, { recursive: true });

  const written = await Promise.all(
    names.map(async (name) => {
      const to = join(target, name);

      await mkdir(dirname(to), { recursive: true });
      await copyFile(join(base, name), to);

      return hashOf(to);
    })
  );

  const hashes = written.filter((hash): hash is string => hash !== null);
  const preview = await copiedPreview(draft.preview, target);

  const manifest: AssetManifest = {
    createdAt: now,
    dependencies: draft.dependencies,
    description: draft.description,
    duration: draft.duration,
    files: names,
    hashes,
    name: draft.name,
    preview,
    proxied: false,
    proxy: null,
    type: draft.type,
  };

  await writeFile(join(target, MANIFEST), stringify(manifest), "utf8");

  return assetOf(dir, slug, manifest);
}

// A thumbnail is decoration: a picture that would not copy leaves the asset
// with its type icon rather than failing the save it belongs to.
async function copiedPreview(
  from: string | null,
  target: string
): Promise<string | null> {
  if (from === null) {
    return null;
  }

  try {
    await copyFile(from, join(target, PREVIEW));
    return PREVIEW;
  } catch {
    return null;
  }
}

function freeSlug(dir: string, wanted: string): string {
  let slug = wanted;
  let suffix = 2;

  while (existsSync(join(dir, slug))) {
    slug = `${wanted}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function manifestIn(
  dir: string,
  slug: string
): Promise<AssetManifest | null> {
  try {
    const source = await readFile(join(dir, slug, MANIFEST), "utf8");
    const decoded = decodeManifest(JSON.parse(source));
    return Exit.isSuccess(decoded) ? decoded.value : null;
  } catch {
    return null;
  }
}

async function assetIn(dir: string, slug: string): Promise<Asset | null> {
  const manifest = await manifestIn(dir, slug);
  return manifest === null ? null : assetOf(dir, slug, manifest);
}

function assetOf(dir: string, slug: string, manifest: AssetManifest): Asset {
  const path = join(dir, slug);
  const named = manifest.preview ?? ownPreview(manifest);
  const preview = named === null ? null : join(path, named);
  const clip = join(path, CLIP);

  return {
    category: null,
    clip: existsSync(clip) ? clip : null,
    createdAt: manifest.createdAt,
    dependencies: manifest.dependencies,
    description: manifest.description,
    duration: manifest.duration,
    files: manifest.files,
    name: manifest.name,
    path,
    preview: preview !== null && existsSync(preview) ? preview : null,
    proxied: manifest.proxied,
    slug,
    type: manifest.type,
  };
}

function ownPreview(manifest: AssetManifest): string | null {
  return manifest.type === "img" && manifest.files.length === 1
    ? (manifest.files[0] ?? null)
    : null;
}

async function knownHashes(): Promise<ReadonlySet<string>> {
  const root = libraryRoot();
  const dir = join(root, ASSETS);
  const entries = await readdir(dir, { withFileTypes: true });

  const manifests = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => manifestIn(dir, entry.name))
  );

  const known = await dismissedHashes(root);

  for (const manifest of manifests) {
    for (const hash of manifest?.hashes ?? []) {
      known.add(hash);
    }
  }

  return known;
}

async function dismissedHashes(root: string): Promise<Set<string>> {
  try {
    const source = await readFile(join(root, DISMISSED), "utf8");
    const parsed = JSON.parse(source) as { hashes?: unknown };

    return new Set(
      Array.isArray(parsed.hashes)
        ? parsed.hashes.filter(
            (hash): hash is string => typeof hash === "string"
          )
        : []
    );
  } catch {
    return new Set();
  }
}

async function hashOf(path: string): Promise<string | null> {
  try {
    return createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  } catch {
    return null;
  }
}

function commonDir(files: readonly string[]): string {
  const [first] = files;
  if (first === undefined) {
    return "";
  }

  let base = dirname(first);

  for (const file of files.slice(1)) {
    while (!(file === base || file.startsWith(`${base}${sep}`))) {
      const parent = dirname(base);
      if (parent === base) {
        return base;
      }
      base = parent;
    }
  }

  return base;
}

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
