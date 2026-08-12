import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import type { ExportEvent, Exported, ExportProgress } from "@/shared/ipc";
import { type Measured, PreviewError, type RenderOptions } from "./project";
import {
  type CompositionCache,
  DELAY_RENDER_TIMEOUT_MS,
  type Renderer,
  readyBrowser,
  renderError,
  slug,
  warmComposition,
} from "./still";

export const CODEC = "h264";
export const EXTENSION = ".mp4";
export const OUT_DIR = "out";

const CANCEL_GRACE_MS = 10_000;
const LOG_LEVEL = "error";

export interface RenderMediaProgress {
  encodedFrames: number;
  progress: number;
  renderedFrames: number;
  stitchStage: string;
}

export interface Cancellation {
  cancel: () => void;
  cancelSignal: unknown;
}

export interface RenderMediaOptions {
  cancelSignal: unknown;
  chromeMode?: string;
  chromiumOptions: Record<string, unknown>;
  codec: string;
  composition: Measured;
  frameRange?: [number, number];
  logLevel: string;
  onProgress: (progress: RenderMediaProgress) => void;
  onStart: (data: { frameCount: number }) => void;
  outputLocation: string;
  overwrite: boolean;
  scale?: number;
  serveUrl: string;
  timeoutInMilliseconds: number;
}

export interface Exporter {
  makeCancelSignal: () => Cancellation;
  renderMedia: (options: RenderMediaOptions) => Promise<unknown>;
}

export interface ExportInput {
  cache: CompositionCache;
  composition: string;
  onEvent: (event: ExportEvent) => void;
  options: RenderOptions;
  renderer: Exporter & Renderer;
  root: string;
  serveUrl: string;
}

export function exporterOf(
  renderer: Renderer
): Effect.Effect<Exporter & Renderer, PreviewError> {
  const found = renderer as Partial<Exporter> & Renderer;

  if (
    typeof found.renderMedia === "function" &&
    typeof found.makeCancelSignal === "function"
  ) {
    return Effect.succeed(found as Exporter & Renderer);
  }

  return Effect.fail(
    new PreviewError({
      message:
        "this project's @remotion/renderer does not expose renderMedia, so there is nothing here that can encode a video — upgrade Remotion in the project folder",
    })
  );
}

export function exportMedia(
  input: ExportInput
): Effect.Effect<Exported, PreviewError> {
  return Effect.gen(function* () {
    yield* readyBrowser({
      onEvent: input.onEvent,
      options: input.options,
      renderer: input.renderer,
    });

    const measured = yield* warmComposition({
      cache: input.cache,
      composition: input.composition,
      options: input.options,
      renderer: input.renderer,
      serveUrl: input.serveUrl,
    });

    const stem = slug(input.composition);
    const folder = path.join(input.root, OUT_DIR);
    const output = path.join(folder, `${stem}${EXTENSION}`);
    const partial = path.join(
      folder,
      `.${stem}-${randomBytes(4).toString("hex")}${EXTENSION}`
    );

    yield* Effect.acquireRelease(
      Effect.tryPromise({
        catch: renderError,
        try: () => mkdir(folder, { recursive: true }),
      }),
      () => Effect.ignore(Effect.promise(() => rm(partial, { force: true })))
    );

    yield* render(input, measured, partial);

    yield* Effect.tryPromise({
      catch: renderError,
      try: () => rename(partial, output),
    });

    const bytes = yield* Effect.tryPromise({
      catch: renderError,
      try: async () => (await stat(output)).size,
    });

    return { bytes, path: output };
  }).pipe(Effect.scoped);
}

function render(
  input: ExportInput,
  measured: Measured,
  output: string,
  extra: Partial<RenderMediaOptions> = {}
): Effect.Effect<void, PreviewError> {
  const { chromeMode, chromiumOptions } = input.options;
  const timeoutInMilliseconds =
    input.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS;

  return Effect.callback<void, PreviewError>((resume) => {
    let total = frameCountOf(measured);
    const { cancel, cancelSignal } = input.renderer.makeCancelSignal();

    const settled = input.renderer
      .renderMedia({
        ...(chromeMode === null ? {} : { chromeMode }),
        cancelSignal,
        chromiumOptions,
        codec: CODEC,
        composition: measured,
        logLevel: LOG_LEVEL,
        onProgress: (progress) => input.onEvent(progressOf(progress, total)),
        onStart: (data) => {
          total = data.frameCount;
        },
        outputLocation: output,
        overwrite: true,
        serveUrl: input.serveUrl,
        timeoutInMilliseconds,
        ...extra,
      })
      .then(
        () => resume(Effect.void),
        (cause: unknown) => resume(Effect.fail(renderError(cause)))
      );

    return Effect.promise(() => {
      cancel();
      return settled;
    }).pipe(Effect.timeout(CANCEL_GRACE_MS), Effect.ignore);
  });
}

const CLIP_SECONDS = 6;
const CLIP_WIDTH = 640;
const CLIPS_DIR = "clips";

export interface ClipInput {
  cache: CompositionCache;
  composition: string;
  dir: string;
  frame: number;
  options: RenderOptions;
  renderer: Exporter & Renderer;
  serveUrl: string;
}

// A hover preview, not an export: a few seconds of the composition from the
// frame the person is looking at, downscaled so a grid of cards costs little
// to decode. Best-effort by contract — the caller swallows every failure.
export function clipMedia(
  input: ClipInput
): Effect.Effect<string, PreviewError> {
  return Effect.gen(function* () {
    yield* readyBrowser({
      onEvent: () => undefined,
      options: input.options,
      renderer: input.renderer,
    });

    const measured = yield* warmComposition({
      cache: input.cache,
      composition: input.composition,
      options: input.options,
      renderer: input.renderer,
      serveUrl: input.serveUrl,
    });

    const folder = path.join(input.dir, CLIPS_DIR);

    yield* Effect.tryPromise({
      catch: renderError,
      try: async () => {
        await rm(folder, { force: true, recursive: true });
        await mkdir(folder, { recursive: true });
      },
    });

    const output = path.join(
      folder,
      `clip-${randomBytes(4).toString("hex")}${EXTENSION}`
    );

    const fps = numberOf(measured.fps, 30);
    const duration = frameCountOf(measured);
    const start = Math.max(0, Math.min(Math.trunc(input.frame), duration - 1));
    const end = Math.min(
      duration - 1,
      start + Math.round(CLIP_SECONDS * fps) - 1
    );
    const scale = Math.min(1, CLIP_WIDTH / Math.max(1, measured.width));

    yield* render(
      {
        cache: input.cache,
        composition: input.composition,
        onEvent: () => undefined,
        options: input.options,
        renderer: input.renderer,
        root: input.dir,
        serveUrl: input.serveUrl,
      },
      measured,
      output,
      { frameRange: [start, Math.max(start, end)], scale }
    );

    return output;
  });
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function progressOf(
  progress: RenderMediaProgress,
  total: number
): ExportProgress {
  return {
    encoded: whole(progress.encodedFrames),
    percent: percentOf(progress.progress),
    rendered: whole(progress.renderedFrames),
    stage: progress.stitchStage === "muxing" ? "muxing" : "encoding",
    total: whole(total),
    type: "progress",
  };
}

function frameCountOf(measured: Measured): number {
  const found = measured.durationInFrames;
  return typeof found === "number" ? whole(found) : 0;
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function percentOf(value: number): number {
  return Math.min(100, whole(value * 100));
}
