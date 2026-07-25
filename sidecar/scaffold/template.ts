import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";

export class ScaffoldError extends Data.TaggedError("ScaffoldError")<{
  message: string;
}> {}

const MANIFEST = "package.json";
const FALLBACK_NAME = "remotion-project";
const UNSAFE = /[^a-z0-9._-]+/g;
const EDGES = /^[-_.]+|[-_.]+$/g;

export function expandTemplate(
  target: string
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
      try: () => copyInto(source, target, packageName(target)),
    });
  });
}

export function packageName(target: string): string {
  const slug = basename(target)
    .toLowerCase()
    .replace(UNSAFE, "-")
    .replace(EDGES, "");

  return slug.length === 0 ? FALLBACK_NAME : slug;
}

async function copyInto(
  source: string,
  target: string,
  name: string
): Promise<void> {
  await mkdir(target, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) => {
      const from = join(source, entry.name);
      const to = join(target, entry.name);

      return entry.isDirectory()
        ? copyInto(from, to, name)
        : copyFile(from, to, entry.name === MANIFEST ? name : null);
    })
  );
}

async function copyFile(
  from: string,
  to: string,
  name: string | null
): Promise<void> {
  if (await exists(to)) {
    return;
  }

  const content = await readFile(from, "utf8");
  await writeFile(to, name === null ? content : named(content, name), "utf8");
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
