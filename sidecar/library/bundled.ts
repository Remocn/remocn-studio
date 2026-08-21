import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Exit, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { REMOCN_DIR_ENV } from "@/shared/ipc";
import { type Asset, BUNDLED_PREFIX } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";
import { bundledRoleOf } from "./roles";
import { LibraryError } from "./store";

const REGISTRY = "registry";
const MANIFEST = "manifest.json";
const POSTER = "poster.png";
export const CLIP = "preview.mp4";

const VendoredFile = Schema.Struct({
  file: Schema.NonEmptyString,
  target: Schema.NonEmptyString,
});

export const VendoredManifest = Schema.Struct({
  category: Schema.NullOr(Schema.NonEmptyString),
  dependencies: Schema.Array(Schema.String),
  description: Schema.String,
  files: Schema.Array(VendoredFile),
  name: Schema.NonEmptyString,
  registryDependencies: Schema.Array(Schema.NonEmptyString),
  title: Schema.NonEmptyString,
});

export type VendoredManifest = (typeof VendoredManifest)["Type"];

const VendoredIndex = Schema.Struct({
  categories: Schema.Array(Schema.NonEmptyString),
  components: Schema.Array(Schema.NonEmptyString),
});

const decodeManifest = Schema.decodeUnknownExit(VendoredManifest);
const decodeIndex = Schema.decodeUnknownExit(VendoredIndex);

const failed = (cause: unknown) =>
  new LibraryError({ message: errorMessage(cause) });

export function remocnRoot(): string | null {
  return process.env[REMOCN_DIR_ENV] ?? null;
}

async function manifestOf(name: string): Promise<VendoredManifest | null> {
  const root = remocnRoot();
  if (root === null) {
    return null;
  }

  try {
    const source = await readFile(join(root, REGISTRY, name, MANIFEST), "utf8");
    const decoded = decodeManifest(JSON.parse(source));
    return Exit.isSuccess(decoded) ? decoded.value : null;
  } catch {
    return null;
  }
}

// The bundled set, worded as assets so the pane, the composer reference and
// the prompt trailer need no second shape. Transitive registry items carry no
// category and are not listed — they ride along at placement time only.
export function listBundled(): Effect.Effect<readonly Asset[], LibraryError> {
  return Effect.tryPromise({
    catch: failed,
    try: async () => {
      const root = remocnRoot();
      if (root === null) {
        return [];
      }

      const source = await readFile(join(root, "index.json"), "utf8").catch(
        () => null
      );
      if (source === null) {
        return [];
      }

      const decoded = decodeIndex(JSON.parse(source));
      if (!Exit.isSuccess(decoded)) {
        return [];
      }

      const listed = await Promise.all(
        decoded.value.components.map(async (name) => {
          const manifest = await manifestOf(name);
          return manifest === null ? null : assetOf(root, name, manifest);
        })
      );

      return listed.filter((asset): asset is Asset => asset !== null);
    },
  });
}

function assetOf(
  root: string,
  name: string,
  manifest: VendoredManifest
): Asset {
  const path = join(root, REGISTRY, name);
  const poster = join(path, POSTER);
  const clip = join(path, CLIP);

  return {
    category: manifest.category,
    clip: existsSync(clip) ? clip : null,
    createdAt: 0,
    dependencies: manifest.dependencies.filter(
      (dependency): dependency is string => dependency.length > 0
    ),
    description: manifest.description,
    duration: null,
    files: manifest.files.map((file) => file.file),
    name: manifest.title,
    path,
    preview: existsSync(poster) ? poster : null,
    proxied: false,
    role: bundledRoleOf(name),
    slug: `${BUNDLED_PREFIX}${name}`,
    type: "component",
  };
}

export interface BundledPlan {
  readonly dependencies: readonly string[];
  readonly files: readonly { from: string; target: string }[];
  readonly role: MotionRole | null;
  readonly title: string;
}

async function closureOf(
  name: string,
  seen: Set<string>,
  found: VendoredManifest[]
): Promise<void> {
  if (seen.has(name)) {
    return;
  }
  seen.add(name);

  const manifest = await manifestOf(name);
  if (manifest === null) {
    return;
  }
  found.push(manifest);

  await Promise.all(
    manifest.registryDependencies.map((referenced) =>
      closureOf(referenced, seen, found)
    )
  );
}

// The registry closure: the picked component plus everything its
// registryDependencies pull in — the shared runtime, an icon set — laid out
// exactly as `shadcn add` would lay it out, which is what lets the
// never-overwrite rule deduplicate the runtime across components.
export function bundledPlan(
  name: string
): Effect.Effect<BundledPlan | null, LibraryError> {
  return Effect.tryPromise({
    catch: failed,
    try: async () => {
      const root = remocnRoot();
      if (root === null) {
        return null;
      }

      const found: VendoredManifest[] = [];
      await closureOf(name, new Set(), found);

      const [first] = found;
      if (first === undefined || first.name !== name) {
        return null;
      }

      const dependencies = new Set<string>();
      const files: { from: string; target: string }[] = [];

      for (const manifest of found) {
        for (const file of manifest.files) {
          files.push({
            from: join(root, REGISTRY, manifest.name, file.file),
            target: file.target,
          });
        }
        for (const dependency of manifest.dependencies) {
          if (dependency.length > 0) {
            dependencies.add(dependency);
          }
        }
      }

      return {
        dependencies: [...dependencies],
        files,
        role: bundledRoleOf(first.name),
        title: first.title,
      };
    },
  });
}
