import { randomBytes } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { Still, StillEvent } from "@/shared/ipc";
import { PreviewError } from "./project";

export const CAPTURE_TIMEOUT_MS = 120_000;
export const DELAY_RENDER_TIMEOUT_MS = 20_000;

const LOG_LEVEL = "error";
const UNSAFE = /[^a-zA-Z0-9._-]+/g;

export interface Measured {
  height: number;
  width: number;
}

export interface DownloadProgress {
  percent: number;
}

export interface Renderer {
  ensureBrowser: (options: {
    logLevel: string;
    onBrowserDownload: () => {
      onProgress: (progress: DownloadProgress) => void;
      version: string | null;
    };
  }) => Promise<unknown>;
  renderStill: (options: {
    composition: Measured;
    frame: number;
    imageFormat: string;
    logLevel: string;
    output: string;
    overwrite: boolean;
    serveUrl: string;
    timeoutInMilliseconds: number;
  }) => Promise<unknown>;
  selectComposition: (options: {
    id: string;
    logLevel: string;
    serveUrl: string;
    timeoutInMilliseconds: number;
  }) => Promise<Measured>;
}

export interface StillRequest {
  composition: string;
  frame: number;
}

export interface StillInput {
  dir: string;
  onEvent: (event: StillEvent) => void;
  renderer: Renderer;
  request: StillRequest;
  serveUrl: string;
  timeoutMs?: number;
}

const failed = (cause: unknown) =>
  new PreviewError({ message: errorMessage(cause) });

export function captureStill(
  input: StillInput
): Effect.Effect<Still, PreviewError> {
  return Effect.gen(function* () {
    const output = yield* freshFile(input.dir, input.request);

    yield* Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.ensureBrowser({
          logLevel: LOG_LEVEL,
          onBrowserDownload: () => ({
            onProgress: (progress) =>
              input.onEvent({
                percent: Math.round(progress.percent * 100),
                type: "browser",
              }),
            version: null,
          }),
        }),
    });

    yield* Effect.sync(() => input.onEvent({ type: "rendering" }));

    const measured = yield* Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.selectComposition({
          id: input.request.composition,
          logLevel: LOG_LEVEL,
          serveUrl: input.serveUrl,
          timeoutInMilliseconds: DELAY_RENDER_TIMEOUT_MS,
        }),
    });

    yield* Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.renderStill({
          composition: measured,
          frame: Math.max(0, Math.trunc(input.request.frame)),
          imageFormat: "png",
          logLevel: LOG_LEVEL,
          output,
          overwrite: true,
          serveUrl: input.serveUrl,
          timeoutInMilliseconds: DELAY_RENDER_TIMEOUT_MS,
        }),
    });

    return {
      height: Math.round(measured.height),
      path: output,
      width: Math.round(measured.width),
    };
  }).pipe(
    Effect.timeoutOrElse({
      duration: input.timeoutMs ?? CAPTURE_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new PreviewError({
            message: `${input.request.composition} did not render a frame in time — a delayRender() in the project may never be resolving`,
          })
        ),
    })
  );
}

function freshFile(
  dir: string,
  request: StillRequest
): Effect.Effect<string, PreviewError> {
  return Effect.tryPromise({
    catch: failed,
    try: async () => {
      await mkdir(dir, { recursive: true });

      const stale = await readdir(dir);

      await Promise.all(
        stale.map((name) =>
          rm(path.join(dir, name), { force: true, recursive: true })
        )
      );

      const stem = slug(request.composition);
      const token = randomBytes(4).toString("hex");

      return path.join(dir, `${stem}-frame-${request.frame}-${token}.png`);
    },
  });
}

function slug(composition: string): string {
  const cleaned = composition.replace(UNSAFE, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "still";
}
