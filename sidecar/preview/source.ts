import { writeFile } from "node:fs/promises";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { PreviewError, type RenderOptions } from "./project";
import type { WarmInternals } from "./session";

interface SourcePage {
  _client: () => {
    send: (
      method: string,
      params?: Record<string, unknown>
    ) => Promise<{
      data?: string;
      value?: { data?: string };
    }>;
  };
  evaluate: (pageFunction: () => unknown) => Promise<unknown>;
  goto: (options: { timeout: number; url: string }) => Promise<unknown>;
  setViewport: (viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  }) => Promise<unknown>;
}

interface SourceBrowser {
  close: (options: { silent: boolean }) => Promise<unknown>;
  newPage: (options: Record<string, unknown>) => Promise<SourcePage>;
}

export function captureSourcePage(input: {
  readonly internals: WarmInternals;
  readonly options: RenderOptions;
  readonly output: string;
  readonly timeoutMs: number;
  readonly url: string;
}): Effect.Effect<string, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) => new PreviewError({ message: errorMessage(cause) }),
    try: async () => {
      const browser = (await input.internals.openBrowser("chrome", {
        ...(input.options.chromeMode === null
          ? {}
          : { chromeMode: input.options.chromeMode }),
        chromiumOptions: input.options.chromiumOptions,
        forceDeviceScaleFactor: 1,
        logLevel: "error",
      })) as unknown as SourceBrowser;

      try {
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
          height: 900,
          width: 1440,
        });
        await page.goto({ timeout: input.timeoutMs, url: input.url });
        await page.evaluate(async () => {
          await document.fonts?.ready;
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        });
        const captured = await page._client().send("Page.captureScreenshot", {
          captureBeyondViewport: false,
          format: "png",
          fromSurface: true,
        });
        const data = captured.value?.data ?? captured.data;
        if (typeof data !== "string" || data.length === 0) {
          throw new Error("Chrome returned no screenshot bytes");
        }
        await writeFile(input.output, Buffer.from(data, "base64"));
        return input.output;
      } finally {
        await browser.close({ silent: true });
      }
    },
  });
}
