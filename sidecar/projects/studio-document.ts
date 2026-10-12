import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { Data, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { ShaderTarget } from "@/shared/shader-target";
import {
  applyStudioOperation,
  isCreationOperation,
  type StudioCreateOperation,
  StudioDocument,
  type StudioObjectOperation,
  type StudioOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import type { ShaderError } from "../library/shaders";
import { remotionRootOf } from "../preview/project";
import { installRuntime } from "../scaffold/registry";
import {
  atomicJson,
  contained,
  hashBytes,
  serialized,
  withConfigLock,
} from "./config";

export class StudioDocumentError extends Data.TaggedError(
  "StudioDocumentError"
)<{
  message: string;
}> {}

const decode = Schema.decodeUnknownEffect(StudioDocument);
const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function documentPath(video: string): string {
  if (!SLUG.test(video)) {
    throw new StudioDocumentError({
      message: "Choose a Studio video before editing its properties.",
    });
  }
  return `src/videos/${video}/studio.json`;
}

function attempt<A>(work: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => new StudioDocumentError({ message: errorMessage(cause) }),
    try: work,
  });
}

function read(root: string, video: string) {
  return Effect.gen(function* () {
    const text = yield* attempt(async () => {
      const path = await contained(root, documentPath(video));
      return readFile(path, "utf8");
    });
    const raw = yield* Effect.try({
      catch: () =>
        new StudioDocumentError({
          message:
            "The object's document is not valid JSON. Finish or repair the file before editing.",
        }),
      try: () => JSON.parse(text) as unknown,
    });
    const document = yield* decode(raw, { onExcessProperty: "error" }).pipe(
      Effect.mapError(
        (cause) =>
          new StudioDocumentError({
            message: `This video's editable document is invalid or uses an unsupported format: ${cause.message}`,
          })
      )
    );
    if (document.video !== video) {
      return yield* Effect.fail(
        new StudioDocumentError({
          message: "This object document belongs to a different video.",
        })
      );
    }
    return { document, revision: hashBytes(text), text };
  });
}

export function readStudioDocument(folder: string, video: string) {
  return read(remotionRootOf(folder), video).pipe(
    Effect.map(
      ({ document, revision }): StudioSnapshot => ({ document, revision })
    )
  );
}

export function writeStudioDocument(
  folder: string,
  video: string,
  operation: StudioOperation
) {
  if (isCreationOperation(operation)) {
    return Effect.fail(
      new StudioDocumentError({
        message:
          "Create shaders through the prepared insertion request, not a property patch.",
      })
    );
  }
  const root = remotionRootOf(folder);
  return attempt(() =>
    serialized(root, () =>
      withConfigLock(root, async () => {
        const current = await Effect.runPromise(read(root, video));
        const next = applyStudioOperation(current.document, operation);
        if (next === current.document) {
          return { document: current.document, revision: current.revision };
        }
        await Effect.runPromise(decode(next));
        const path = documentPath(video);
        const now = await readFile(await contained(root, path), "utf8");
        if (now !== current.text) {
          throw new StudioDocumentError({
            message:
              "The video changed while saving. Reload the properties and try again.",
          });
        }
        await atomicJson(root, path, next);
        const saved = `${JSON.stringify(next, null, 2)}\n`;
        return { document: next, revision: hashBytes(saved) };
      })
    )
  );
}

export function commitStudioCreation(
  folder: string,
  video: string,
  operation: StudioCreateOperation,
  verifyTarget: Effect.Effect<ShaderTarget, ShaderError>
) {
  const root = remotionRootOf(folder);
  return attempt(() =>
    serialized(root, () =>
      withConfigLock(root, async () => {
        const current = await Effect.runPromise(read(root, video));
        if (
          current.document.operations.some((item) => item.id === operation.id)
        ) {
          applyStudioOperation(current.document, operation);
          return { document: current.document, revision: current.revision };
        }
        const target = await Effect.runPromise(verifyTarget);
        const next = applyStudioOperation(current.document, operation, target);
        await Effect.runPromise(decode(next, { onExcessProperty: "error" }));
        const path = documentPath(video);
        const now = await readFile(await contained(root, path), "utf8");
        if (now !== current.text) {
          throw new StudioDocumentError({
            message:
              "The video changed while adding the shader. Reload the preview and retry.",
          });
        }
        await atomicJson(root, path, next);
        return {
          document: next,
          revision: hashBytes(`${JSON.stringify(next, null, 2)}\n`),
        };
      })
    )
  ).pipe(Effect.uninterruptible);
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const PROVIDER_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*(["'])([^"']*\/studio-objects-v(\d+)(?:\/index(?:\.tsx?)?)?)\2/g;
const TYPE_PREFIX = /^type\s+/;
const ALIAS = /\s+as\s+/;
const V5 = /studio-objects-v5/;

interface Provider {
  readonly path: string;
  readonly specifier: string;
  readonly start: number;
  readonly text: string;
  readonly version: number;
}

function importsProvider(names: string): boolean {
  return names
    .split(",")
    .map((name) => name.trim().replace(TYPE_PREFIX, "").split(ALIAS)[0])
    .includes("StudioObjects");
}

async function sourcesUnder(folder: string): Promise<string[]> {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && SOURCE_FILE.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function providersIn(path: string, text: string): Provider[] {
  return [...text.matchAll(PROVIDER_IMPORT)]
    .filter((match) => importsProvider(match[1]))
    .map((match) => ({
      path,
      specifier: match[3],
      start: (match.index ?? 0) + match[0].lastIndexOf(match[3]),
      text,
      version: Number(match[4]),
    }));
}

async function providerOf(root: string, video: string): Promise<Provider> {
  const folder = await contained(root, `src/videos/${video}`);
  const files = await sourcesUnder(folder);
  const found = (
    await Promise.all(
      files.map(async (file) =>
        providersIn(
          join("src", "videos", video, relative(folder, file)),
          await readFile(file, "utf8")
        )
      )
    )
  ).flat();
  if (found.length === 0) {
    throw new StudioDocumentError({
      message:
        "This video does not load its objects through the studio's runtime, so they cannot be deleted here.",
    });
  }
  if (found.length > 1) {
    throw new StudioDocumentError({
      message:
        "This video loads its objects in more than one place, so the studio cannot upgrade it to delete objects.",
    });
  }
  const [provider] = found;
  if (provider.version < 5) {
    throw new StudioDocumentError({
      message: "This video's editing runtime is too old to delete objects.",
    });
  }
  return provider;
}

function upgradedText(provider: Provider): string {
  const specifier = provider.specifier.replace(V5, "studio-objects-v6");
  return (
    provider.text.slice(0, provider.start) +
    specifier +
    provider.text.slice(provider.start + provider.specifier.length)
  );
}

async function upgrade(root: string, provider: Provider): Promise<string> {
  const target = await contained(root, provider.path);
  await installRuntime(root, "studio-objects-v6");
  await writeFile(target, upgradedText(provider), "utf8").catch((cause) => {
    throw new StudioDocumentError({
      message: `${provider.path} could not be upgraded to delete objects: ${errorMessage(cause)}`,
    });
  });
  return target;
}

async function replaceDocument(
  root: string,
  video: string,
  before: string,
  next: StudioDocument
): Promise<void> {
  const path = documentPath(video);
  const now = await readFile(await contained(root, path), "utf8");
  if (now !== before) {
    throw new StudioDocumentError({
      message: "The video changed while deleting. Try again.",
    });
  }
  await atomicJson(root, path, next);
}

async function removeLocked(
  root: string,
  video: string,
  operation: StudioObjectOperation
) {
  const current = await Effect.runPromise(read(root, video));
  const next = applyStudioOperation(current.document, operation);
  if (next === current.document) {
    return {
      document: current.document,
      revision: current.revision,
      upgraded: null,
    };
  }
  await Effect.runPromise(decode(next));
  const provider = await providerOf(root, video);
  const upgraded =
    provider.version === 5 ? await upgrade(root, provider) : null;
  try {
    await replaceDocument(root, video, current.text, next);
  } catch (cause) {
    if (upgraded !== null) {
      await writeFile(upgraded, provider.text, "utf8");
    }
    throw cause;
  }
  return {
    document: next,
    revision: hashBytes(`${JSON.stringify(next, null, 2)}\n`),
    upgraded: upgraded === null ? null : provider.path,
  };
}

export function removeStudioObject(
  folder: string,
  video: string,
  operation: StudioObjectOperation
) {
  const root = remotionRootOf(folder);
  return attempt(() =>
    serialized(root, () =>
      withConfigLock(root, () => removeLocked(root, video, operation))
    )
  );
}
