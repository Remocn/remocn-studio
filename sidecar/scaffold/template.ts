import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV, type VideoSize } from "@/shared/ipc";
import { hashBytes, hashSources } from "../projects/config";
import { stampVideoOrigin } from "./video-origin";

export class ScaffoldError extends Data.TaggedError("ScaffoldError")<{
  message: string;
}> {}

const MANIFEST = "package.json";
const META = "meta";
const FALLBACK_NAME = "remotion-project";
const UNSAFE = /[^a-z0-9._-]+/g;
const EDGES = /^[-_.]+|[-_.]+$/g;
const WIDTH = /width: \d+/;
const HEIGHT = /height: \d+/;
const NAME_SLOT = /__VIDEO_NAME__/g;

// The project template carries the video module it stamps out, so one
// resource ships both. It is not part of a project: `video.create` is the
// only thing that reads it, for the first video and for every one after.
export const VIDEO_TEMPLATE = "video-template";
export const VIDEO_TEMPLATES = "video-templates";
export const REGISTRY_TEMPLATE = "registry.tsx";
export const VIDEOS_DIR = "videos";

type Rewrite = (content: string) => string;

export interface VideoDraft {
  readonly name: string;
  readonly size: VideoSize;
  readonly slug: string;
}

export function expandTemplate(
  target: string
): Effect.Effect<void, ScaffoldError> {
  return template((source) =>
    copyInto(source, target, rewriteFor(target), skipVideoTemplate)
  );
}

// A video is a folder under src/videos, and the scan in the project's own
// Root.tsx is what registers it. Nothing edits Root.tsx — not us, not the
// agent — so two videos created at once cannot race for one file.
export function expandVideo(
  target: string,
  draft: VideoDraft
): Effect.Effect<string, ScaffoldError> {
  const folder = join(target, "src", VIDEOS_DIR, draft.slug);

  return template(async (source) => {
    const existing = await access(join(folder, "index.tsx")).then(
      () => true,
      () => false
    );
    await copyInto(
      join(source, VIDEO_TEMPLATE),
      folder,
      (entry) => (content) => {
        if (entry === "studio.json") {
          return content
            .replace(/"__VIDEO_NAME__"/g, JSON.stringify(draft.name))
            .replace(/"__VIDEO_ID__"/g, JSON.stringify(draft.slug));
        }
        return entry === "index.tsx" ? stamped(content, draft) : content;
      },
      () => false
    );

    if (existing) {
      return folder;
    }
    await stampVideoOrigin(folder);
    const indexPath = `src/videos/${draft.slug}/index.tsx`;
    const sources = {
      [indexPath]: hashBytes(await readFile(join(folder, "index.tsx"), "utf8")),
      [`src/videos/${draft.slug}/shader-registry.ts`]: hashBytes(
        await readFile(join(folder, "shader-registry.ts"), "utf8")
      ),
    };
    await writeFile(
      join(folder, "studio-shaders.json"),
      `${JSON.stringify(
        {
          implementations: [],
          slots: [
            {
              id: "root-shaders",
              label: "Whole video",
              sceneId: null,
              source: indexPath,
            },
          ],
          sourceRevision: hashSources(sources),
          sources,
          version: 1,
          video: draft.slug,
        },
        null,
        2
      )}\n`,
      { flag: "wx" }
    );
    return folder;
  });
}

export function sized(content: string, { height, width }: VideoSize): string {
  if (!(WIDTH.test(content) && HEIGHT.test(content))) {
    throw new Error(
      `the ${VIDEO_TEMPLATE} no longer declares ${META} width and height as literals, so ${width}×${height} could not be written into it`
    );
  }

  return content
    .replace(WIDTH, `width: ${width}`)
    .replace(HEIGHT, `height: ${height}`);
}

function stamped(content: string, draft: VideoDraft): string {
  return sized(content, draft.size).replace(NAME_SLOT, draft.name);
}

function template<A>(
  use: (source: string) => Promise<A>
): Effect.Effect<A, ScaffoldError> {
  return Effect.suspend(() => {
    const source = process.env[TEMPLATE_DIR_ENV];

    if (source === undefined) {
      return Effect.fail(
        new ScaffoldError({
          message: `${TEMPLATE_DIR_ENV} is not set, so there is no template to expand`,
        })
      );
    }

    return Effect.tryPromise({
      catch: (cause) => new ScaffoldError({ message: errorMessage(cause) }),
      try: () => use(source),
    });
  });
}

// Both live in the template dir so one resource ships them, and neither is a
// file of the project: the video template is stamped out by `video.create`,
// and the registry is placed by `ensureRegistry`, which also has to reach a
// project the studio never scaffolded.
function skipVideoTemplate(entry: string): boolean {
  return (
    entry === VIDEO_TEMPLATE ||
    entry === VIDEO_TEMPLATES ||
    entry === REGISTRY_TEMPLATE
  );
}

export function packageName(target: string): string {
  const slug = basename(target)
    .toLowerCase()
    .replace(UNSAFE, "-")
    .replace(EDGES, "");

  return slug.length === 0 ? FALLBACK_NAME : slug;
}

function rewriteFor(target: string): (entry: string) => Rewrite | null {
  const name = packageName(target);

  return (entry) =>
    entry === MANIFEST ? (content) => named(content, name) : null;
}

export async function copyInto(
  source: string,
  target: string,
  rewrite: (entry: string) => Rewrite | null,
  skip: (entry: string) => boolean
): Promise<void> {
  await mkdir(target, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => !skip(entry.name))
      .map((entry) => {
        const from = join(source, entry.name);
        const to = join(target, entry.name);

        return entry.isDirectory()
          ? copyInto(from, to, rewrite, skip)
          : copyFile(from, to, rewrite(entry.name));
      })
  );
}

async function copyFile(
  from: string,
  to: string,
  rewrite: Rewrite | null
): Promise<void> {
  if (await exists(to)) {
    return;
  }

  const content = await readFile(from, "utf8");
  await writeFile(to, rewrite === null ? content : rewrite(content), "utf8");
}

function named(content: string, name: string): string {
  const manifest = JSON.parse(content) as Record<string, unknown>;
  return `${JSON.stringify({ ...manifest, name }, null, 2)}\n`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
