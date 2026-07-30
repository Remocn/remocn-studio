import { randomBytes } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { Still, StillEvent } from "@/shared/ipc";
import { type Measured, PreviewError, type RenderOptions } from "./project";

export type { Measured } from "./project";

export const CAPTURE_TIMEOUT_MS = 180_000;
export const DELAY_RENDER_TIMEOUT_MS = 30_000;

const LOG_LEVEL = "error";
const UNSAFE = /[^a-zA-Z0-9._-]+/g;
const STUCK = /delayRender\(\)/;

export interface DownloadProgress {
  percent: number;
}

export interface Renderer {
  ensureBrowser: (options: {
    chromeMode?: string;
    logLevel: string;
    onBrowserDownload: () => {
      onProgress: (progress: DownloadProgress) => void;
      version: string | null;
    };
  }) => Promise<unknown>;
  renderStill: (options: {
    chromeMode?: string;
    chromiumOptions: Record<string, unknown>;
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
    chromeMode?: string;
    chromiumOptions: Record<string, unknown>;
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

export interface CompositionCache {
  forget: () => void;
  read: (composition: string) => Measured | null;
  remember: (composition: string, measured: Measured) => void;
}

export function makeCompositionCache(): CompositionCache {
  const known = new Map<string, Measured>();

  return {
    forget: () => known.clear(),
    read: (composition) => known.get(composition) ?? null,
    remember: (composition, measured) => {
      known.set(composition, measured);
    },
  };
}

export interface StillInput {
  cache: CompositionCache;
  dir: string;
  onEvent: (event: StillEvent) => void;
  options: RenderOptions;
  renderer: Renderer;
  request: StillRequest;
  serveUrl: string;
  timeoutMs?: number;
}

export interface WarmInput {
  cache: CompositionCache;
  composition: string;
  options: RenderOptions;
  renderer: Renderer;
  serveUrl: string;
}

export function warmComposition(
  input: WarmInput
): Effect.Effect<Measured, PreviewError> {
  return Effect.suspend(() => {
    const known = input.cache.read(input.composition);

    if (known !== null) {
      return Effect.succeed(known);
    }

    return measure({
      composition: input.composition,
      options: input.options,
      renderer: input.renderer,
      serveUrl: input.serveUrl,
    }).pipe(
      Effect.tap((measured) =>
        Effect.sync(() => input.cache.remember(input.composition, measured))
      )
    );
  });
}

function measure(input: {
  composition: string;
  options: RenderOptions;
  renderer: Renderer;
  serveUrl: string;
}): Effect.Effect<Measured, PreviewError> {
  const { chromeMode, chromiumOptions } = input.options;

  return Effect.tryPromise({
    catch: failed,
    try: () =>
      input.renderer.selectComposition({
        ...(chromeMode === null ? {} : { chromeMode }),
        chromiumOptions,
        id: input.composition,
        logLevel: LOG_LEVEL,
        serveUrl: input.serveUrl,
        timeoutInMilliseconds:
          input.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS,
      }),
  });
}

const failed = (cause: unknown) =>
  new PreviewError({ message: explain(errorMessage(cause)) });

function explain(message: string): string {
  return STUCK.test(message)
    ? `${message}\n\nThe render browser is not the preview's WebView: it has no GL backend unless the project asks for one, so a scene that draws with WebGL never finishes compiling and its delayRender() never clears. Add Config.setChromiumOpenGlRenderer("angle") to remotion.config.ts — npx remotion still needs the same thing — or raise Config.setDelayRenderTimeoutInMilliseconds() if the scene is merely slow.`
    : message;
}

export function stillFile(
  dir: string,
  request: StillRequest
): Effect.Effect<string, PreviewError> {
  return freshFile(dir, request);
}

export function readyBrowser(
  input: Pick<StillInput, "onEvent" | "options" | "renderer">
): Effect.Effect<void, PreviewError> {
  const { chromeMode } = input.options;

  return Effect.asVoid(
    Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.ensureBrowser({
          ...(chromeMode === null ? {} : { chromeMode }),
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
    })
  );
}

export function captureStill(
  input: StillInput
): Effect.Effect<Still, PreviewError> {
  return Effect.gen(function* () {
    const output = yield* freshFile(input.dir, input.request);
    const { chromeMode, chromiumOptions } = input.options;
    const timeoutInMilliseconds =
      input.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS;

    const mode = chromeMode === null ? {} : { chromeMode };

    yield* Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.ensureBrowser({
          ...mode,
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

    const measured = yield* warmComposition({
      cache: input.cache,
      composition: input.request.composition,
      options: input.options,
      renderer: input.renderer,
      serveUrl: input.serveUrl,
    });

    yield* Effect.tryPromise({
      catch: failed,
      try: () =>
        input.renderer.renderStill({
          ...mode,
          chromiumOptions,
          composition: measured,
          frame: Math.max(0, Math.trunc(input.request.frame)),
          imageFormat: "png",
          logLevel: LOG_LEVEL,
          output,
          overwrite: true,
          serveUrl: input.serveUrl,
          timeoutInMilliseconds,
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
