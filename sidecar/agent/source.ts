import { randomBytes } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { Data, Deferred, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  AgentEvent,
  SourceAssetParams,
  SourceAssetResolution,
} from "@/shared/ipc";
import { sourceFrom } from "../preview/supervisor";

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const WAIT_TIME = "10 minutes";

export class SourceAssetError extends Data.TaggedError("SourceAssetError")<{
  message: string;
}> {}

export interface SourceAssetRequest {
  readonly attempt: string;
  readonly name: string;
  readonly projectId: string;
  readonly projectPath: string;
  readonly source: string;
  readonly turnId: string;
}

interface Pending extends SourceAssetRequest {
  readonly deferred: Deferred.Deferred<SourceAssetResolution>;
}

const pending = new Map<string, Pending>();

export function requestSourceAsset(
  request: SourceAssetRequest,
  emit: (event: AgentEvent) => Effect.Effect<void>
): Effect.Effect<SourceAssetResolution> {
  let pendingId: string | null = null;
  return Effect.gen(function* () {
    const url = sourceUrl(request.source);
    const id = crypto.randomUUID();
    pendingId = id;
    const deferred = yield* Deferred.make<SourceAssetResolution>();
    pending.set(id, { ...request, deferred, source: url.toString() });
    yield* emit({
      attempt: request.attempt,
      id,
      name: request.name,
      source: url.toString(),
      type: "asset_source",
    });
    return yield* Deferred.await(deferred);
  }).pipe(
    Effect.timeoutOrElse({
      duration: WAIT_TIME,
      orElse: () => Effect.succeed(cancelled(request.source)),
    }),
    Effect.ensuring(
      Effect.sync(() => {
        if (pendingId !== null) {
          pending.delete(pendingId);
        }
      })
    )
  );
}

export function answerSourceAsset(
  params: SourceAssetParams
): Effect.Effect<boolean, SourceAssetError> {
  return Effect.suspend(() => {
    const row = pending.get(params.id);
    if (row === undefined) {
      return Effect.succeed(false);
    }

    if (params.action === "cancel") {
      return Deferred.succeed(row.deferred, cancelled(row.source)).pipe(
        Effect.as(true)
      );
    }

    const prepared =
      params.action === "uploaded"
        ? saveUpload(row, params.file)
        : saveScreenshot(row);

    return prepared.pipe(
      Effect.flatMap((resolution) =>
        Deferred.succeed(row.deferred, resolution)
      ),
      Effect.as(true)
    );
  });
}

export function abandonSourceAssets(turnId: string): Effect.Effect<void> {
  return Effect.forEach(
    [...pending].filter(([, row]) => row.turnId === turnId),
    ([id, row]) =>
      Deferred.succeed(row.deferred, cancelled(row.source)).pipe(
        Effect.tap(() => Effect.sync(() => pending.delete(id)))
      ),
    { discard: true }
  );
}

function saveUpload(
  row: Pending,
  file: string | null
): Effect.Effect<SourceAssetResolution, SourceAssetError> {
  return Effect.tryPromise({
    catch: failed,
    try: async () => {
      if (file === null || file.length === 0) {
        throw new Error("Choose an original image file before continuing.");
      }
      const extension = extname(file).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        throw new Error(
          "The original must be an SVG, PNG, JPEG, GIF, WebP or AVIF image."
        );
      }
      const info = await stat(file);
      if (!info.isFile()) {
        throw new Error("The selected original is not a file.");
      }
      const output = await outputPath(row, extension);
      await copyFile(file, output);
      return {
        kind: "uploaded",
        path: projectPath(row.projectPath, output),
        provenance: `Original supplied by the person for ${row.source}`,
      } as const;
    },
  });
}

function saveScreenshot(
  row: Pending
): Effect.Effect<SourceAssetResolution, SourceAssetError> {
  return Effect.gen(function* () {
    const output = yield* Effect.tryPromise({
      catch: failed,
      try: () => outputPath(row, ".png"),
    });
    yield* sourceFrom(row.projectId, { output, url: row.source }).pipe(
      Effect.mapError(
        (error) => new SourceAssetError({ message: error.message })
      )
    );
    return {
      kind: "screenshot" as const,
      path: projectPath(row.projectPath, output),
      provenance: `Unchanged 1440x900 page capture of ${row.source}`,
    };
  });
}

async function outputPath(row: Pending, extension: string): Promise<string> {
  const folder = join(row.projectPath, "video", "assets");
  await mkdir(folder, { recursive: true });
  return join(
    folder,
    `${slug(row.name)}-${randomBytes(4).toString("hex")}${extension}`
  );
}

function projectPath(root: string, file: string): string {
  return relative(root, file).split("\\").join("/");
}

function slug(value: string): string {
  const clean = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return clean.length > 0 ? clean : "source-asset";
}

function sourceUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SourceAssetError({
      message: "A source asset must come from an HTTP(S) URL.",
    });
  }
  return parsed;
}

function cancelled(source: string): SourceAssetResolution {
  return {
    kind: "cancelled",
    path: null,
    provenance: `No source asset was approved for ${source}`,
  };
}

function failed(cause: unknown): SourceAssetError {
  return new SourceAssetError({ message: errorMessage(cause) });
}
