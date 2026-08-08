import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV, type VideoSize } from "@/shared/ipc";

export class ScaffoldError extends Data.TaggedError("ScaffoldError")<{
  message: string;
}> {}

const MANIFEST = "package.json";
const ROOT = "Root.tsx";
const FALLBACK_NAME = "remotion-project";
const UNSAFE = /[^a-z0-9._-]+/g;
const EDGES = /^[-_.]+|[-_.]+$/g;
const WIDTH = /width=\{\d+\}/;
const HEIGHT = /height=\{\d+\}/;

type Rewrite = (content: string) => string;

export function expandTemplate(
  target: string,
  size: VideoSize
): Effect.Effect<void, ScaffoldError> {
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
      try: () => copyInto(source, target, rewriteFor(target, size)),
    });
  });
}

export function sized(content: string, { height, width }: VideoSize): string {
  if (!(WIDTH.test(content) && HEIGHT.test(content))) {
    throw new Error(
      `the template's ${ROOT} no longer declares width and height as literals, so ${width}×${height} could not be written into it`
    );
  }

  return content
    .replace(WIDTH, `width={${width}}`)
    .replace(HEIGHT, `height={${height}}`);
}

export function packageName(target: string): string {
  const slug = basename(target)
    .toLowerCase()
    .replace(UNSAFE, "-")
    .replace(EDGES, "");

  return slug.length === 0 ? FALLBACK_NAME : slug;
}

function rewriteFor(
  target: string,
  size: VideoSize
): (entry: string) => Rewrite | null {
  const name = packageName(target);

  return (entry) => {
    if (entry === MANIFEST) {
      return (content) => named(content, name);
    }
    return entry === ROOT ? (content) => sized(content, size) : null;
  };
}

async function copyInto(
  source: string,
  target: string,
  rewrite: (entry: string) => Rewrite | null
): Promise<void> {
  await mkdir(target, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) => {
      const from = join(source, entry.name);
      const to = join(target, entry.name);

      return entry.isDirectory()
        ? copyInto(from, to, rewrite)
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
