import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { type Measured, PreviewError, type RenderOptions } from "./project";

const FORWARDED = [
  "durationInFrames",
  "fps",
  "height",
  "width",
  "defaultCodec",
  "defaultOutName",
  "defaultVideoImageFormat",
  "defaultPixelFormat",
  "defaultProResProfile",
  "defaultSampleRate",
] as const;

interface Page {
  setViewport: (viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  }) => Promise<unknown>;
}

interface Browser {
  close: (options: { silent: boolean }) => Promise<unknown>;
  newPage: (options: Record<string, unknown>) => Promise<Page>;
}

export interface WarmInternals {
  evaluate: (options: Record<string, unknown>) => Promise<unknown>;
  openBrowser: (
    browser: "chrome",
    options: Record<string, unknown>
  ) => Promise<Browser>;
  seekToFrame: (options: Record<string, unknown>) => Promise<unknown>;
  serialize: (data: unknown) => string;
  setPropsAndEnv: (options: Record<string, unknown>) => Promise<unknown>;
  takeFrame: (options: Record<string, unknown>) => Promise<unknown>;
}

export interface Session {
  readonly capture: (
    frame: number,
    output: string
  ) => Effect.Effect<void, PreviewError>;
  readonly close: Effect.Effect<void>;
  readonly composition: string;
  readonly height: number;
  readonly width: number;
}

export interface SessionInput {
  composition: string;
  internals: WarmInternals;
  measured: Measured;
  options: RenderOptions;
  serveUrl: string;
  timeoutMs: number;
}

const failed = (cause: unknown) =>
  new PreviewError({ message: errorMessage(cause) });

export function openSession(
  input: SessionInput
): Effect.Effect<Session, PreviewError> {
  return Effect.tryPromise({
    catch: failed,
    try: async () => {
      const { internals, options } = input;
      const { chromeMode, chromiumOptions } = options;

      const browser = await internals.openBrowser("chrome", {
        ...(chromeMode === null ? {} : { chromeMode }),
        chromiumOptions,
        forceDeviceScaleFactor: 1,
        logLevel: "error",
      });

      const page = await browser.newPage({
        context: null,
        indent: false,
        logLevel: "error",
        onBrowserLog: null,
        onLog: () => undefined,
        pageIndex: 0,
      });

      await page.setViewport({
        deviceScaleFactor: 1,
        height: input.measured.height,
        width: input.measured.width,
      });

      await internals.setPropsAndEnv({
        audioEnabled: false,
        darkMode: chromiumOptions.darkMode === true,
        envVariables: {},
        indent: false,
        initialFrame: 0,
        initialMemoryAvailable: null,
        isMainTab: true,
        logLevel: "error",
        mediaCacheSizeInBytes: null,
        onServeUrlVisited: () => undefined,
        page,
        proxyPort: 0,
        retriesRemaining: 2,
        sampleRate: 48_000,
        serializedInputPropsWithCustomSchema: internals.serialize({}),
        serveUrl: input.serveUrl,
        timeoutInMilliseconds: input.timeoutMs,
        videoEnabled: true,
      });

      await internals.evaluate({
        args: [
          input.composition,
          internals.serialize(input.measured.props ?? {}),
          ...FORWARDED.map((key) => input.measured[key] ?? null),
        ],
        frame: null,
        page,
        pageFunction: bundleMode,
        timeoutInMilliseconds: input.timeoutMs,
      });

      return { browser, measured: input.measured, page };
    },
  }).pipe(
    Effect.map(({ browser, measured, page }) => ({
      capture: (frame: number, output: string) =>
        Effect.tryPromise({
          catch: failed,
          try: async () => {
            await input.internals.seekToFrame({
              attempt: 0,
              composition: input.composition,
              frame,
              indent: false,
              logLevel: "error",
              page,
              timeoutInMilliseconds: input.timeoutMs,
            });

            await input.internals.takeFrame({
              freePage: page,
              height: measured.height,
              imageFormat: "png",
              jpegQuality: 80,
              output,
              scale: 1,
              timeoutInMilliseconds: input.timeoutMs,
              wantsBuffer: false,
              width: measured.width,
            });
          },
        }),
      close: Effect.ignore(
        Effect.tryPromise(() => browser.close({ silent: true }))
      ),
      composition: input.composition,
      height: Math.round(measured.height),
      width: Math.round(measured.width),
    }))
  );
}

function bundleMode(
  id: string,
  props: string,
  durationInFrames: number,
  fps: number,
  height: number,
  width: number,
  defaultCodec: unknown,
  defaultOutName: unknown,
  defaultVideoImageFormat: unknown,
  defaultPixelFormat: unknown,
  defaultProResProfile: unknown,
  defaultSampleRate: unknown
) {
  (
    window as unknown as { remotion_setBundleMode: (state: unknown) => void }
  ).remotion_setBundleMode({
    compositionDefaultCodec: defaultCodec,
    compositionDefaultOutName: defaultOutName,
    compositionDefaultPixelFormat: defaultPixelFormat,
    compositionDefaultProResProfile: defaultProResProfile,
    compositionDefaultSampleRate: defaultSampleRate,
    compositionDefaultVideoImageFormat: defaultVideoImageFormat,
    compositionDurationInFrames: durationInFrames,
    compositionFps: fps,
    compositionHeight: height,
    compositionName: id,
    compositionWidth: width,
    serializedResolvedPropsWithSchema: props,
    type: "composition",
  });
}
