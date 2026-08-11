import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  type Stats,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { Exit, Schema } from "effect";
import { AssetManifest } from "@/shared/library";
import { ASSETS, MANIFEST } from "../library/store";

const FRESH_FOR_MS = 5000;

const decodeManifest = Schema.decodeUnknownExit(AssetManifest);

export interface Index {
  readonly at: (hash: string) => string | null;
}

export interface Proxies {
  readonly of: (path: string, stats: Stats) => string | null;
}

// What the preview streams instead of the original, when there is one. The file
// asked for is a *copy* inside the project's `public/`, so it is matched by
// content rather than by path — one proxy then covers every project the asset
// was ever inserted into, and footage nobody inserted is simply never matched.
export function proxies(index: Index): Proxies {
  const hashes = new Map<string, string | null>();

  return {
    of: (path, stats) => {
      const key = keyOf(path, stats);
      let hash = hashes.get(key);

      if (hash === undefined) {
        hash = hashed(path);
        hashes.set(key, hash);
      }

      return hash === null ? null : index.at(hash);
    },
  };
}

// A file's identity for as long as this host lives: the hash costs about 40ms on
// a 15MB clip and is paid once, on the range probe a webview opens a video with.
// Size and mtime are what a rewrite changes.
export function keyOf(path: string, stats: Stats): string {
  return `${path}:${stats.size}:${Math.floor(stats.mtimeMs)}`;
}

// Read again after a while rather than on a signal from the sidecar: a proxy is
// filed mid-session, by a conversion that takes minutes, and a scan of a few
// dozen small manifests is cheaper than a channel that would have to be kept in
// step. The lookup has to be synchronous — it happens inside the request
// handler, where a fiber would reorder the response.
export function libraryIndex(root: string, freshForMs = FRESH_FOR_MS): Index {
  let loadedAt = Number.NEGATIVE_INFINITY;
  let known = new Map<string, string>();

  return {
    at: (hash) => {
      const now = Date.now();

      if (now - loadedAt >= freshForMs) {
        known = scan(root);
        loadedAt = now;
      }

      return known.get(hash) ?? null;
    },
  };
}

function scan(root: string): Map<string, string> {
  const index = new Map<string, string>();
  const dir = join(root, ASSETS);

  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return index;
  }

  for (const slug of entries) {
    const manifest = manifestIn(dir, slug);
    const proxy = manifest?.proxy;

    if (!proxy) {
      continue;
    }

    const path = join(dir, slug, proxy);
    if (!existsSync(path)) {
      continue;
    }

    for (const hash of manifest.hashes) {
      index.set(hash, path);
    }
  }

  return index;
}

function manifestIn(dir: string, slug: string): AssetManifest | null {
  try {
    const decoded = decodeManifest(
      JSON.parse(readFileSync(join(dir, slug, MANIFEST), "utf8"))
    );
    return Exit.isSuccess(decoded) ? decoded.value : null;
  } catch {
    return null;
  }
}

function hashed(path: string): string | null {
  try {
    return statSync(path).isFile()
      ? createHash("sha256").update(readFileSync(path)).digest("hex")
      : null;
  } catch {
    return null;
  }
}
