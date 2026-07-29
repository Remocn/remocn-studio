// @vitest-environment node

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import type { StillEvent } from "@/shared/ipc";
import { captureStill, type Renderer } from "./still";

const SERVE_URL = "http://127.0.0.1:51749/__remocn/render/index.html";
const STILL_NAME = /^Main-frame-42-[0-9a-f]+\.png$/;

const made: string[] = [];

function dir(): string {
  const created = mkdtempSync(path.join(tmpdir(), "remocn-still-"));
  made.push(created);
  return created;
}

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

interface Fake {
  downloads: number;
  rendered: { frame: number; output: string; serveUrl: string }[];
  renderer: Renderer;
  selected: string[];
}

function fake(
  overrides: Partial<{
    download: (report: (percent: number) => void) => void;
    measured: { height: number; width: number };
    onRender: () => Promise<unknown>;
    onSelect: () => Promise<{ height: number; width: number }>;
  }> = {}
): Fake {
  const state: Fake = {
    downloads: 0,
    rendered: [],
    renderer: {} as Renderer,
    selected: [],
  };

  const measured = overrides.measured ?? { height: 1080, width: 1920 };

  state.renderer = {
    ensureBrowser: async (options) => {
      state.downloads += 1;
      const { onProgress } = options.onBrowserDownload();
      overrides.download?.((percent) => onProgress({ percent }));
      await Promise.resolve();
    },
    renderStill: async (options) => {
      state.rendered.push({
        frame: options.frame,
        output: options.output,
        serveUrl: options.serveUrl,
      });

      if (overrides.onRender !== undefined) {
        return await overrides.onRender();
      }

      writeFileSync(options.output, "png");
      return await Promise.resolve(null);
    },
    selectComposition: async (options) => {
      state.selected.push(options.id);

      if (overrides.onSelect !== undefined) {
        return await overrides.onSelect();
      }

      return await Promise.resolve(measured);
    },
  };

  return state;
}

function capture(
  renderer: Renderer,
  target: string,
  options: { onEvent?: (event: StillEvent) => void; timeoutMs?: number } = {}
) {
  return captureStill({
    dir: target,
    onEvent: options.onEvent ?? (() => undefined),
    renderer,
    request: { composition: "Main", frame: 42 },
    serveUrl: SERVE_URL,
    timeoutMs: options.timeoutMs,
  });
}

describe("captureStill", () => {
  it("renders the asked-for frame through the project's own renderer", async () => {
    const target = dir();
    const state = fake();

    const still = await Effect.runPromise(capture(state.renderer, target));

    expect(state.selected).toEqual(["Main"]);
    expect(state.rendered).toHaveLength(1);
    expect(state.rendered[0].frame).toBe(42);
    expect(state.rendered[0].serveUrl).toBe(SERVE_URL);
    expect(still).toEqual({
      height: 1080,
      path: state.rendered[0].output,
      width: 1920,
    });
    expect(existsSync(still.path)).toBe(true);
  });

  it("captures at the composition's resolution, not the preview's", async () => {
    const state = fake({ measured: { height: 2160, width: 3840 } });

    const still = await Effect.runPromise(capture(state.renderer, dir()));

    expect({ height: still.height, width: still.width }).toEqual({
      height: 2160,
      width: 3840,
    });
  });

  it("names the file after the composition and the frame", async () => {
    const state = fake();

    const still = await Effect.runPromise(capture(state.renderer, dir()));

    expect(path.basename(still.path)).toMatch(STILL_NAME);
  });

  it("says the browser is downloading before it says it is rendering", async () => {
    const seen: StillEvent[] = [];
    const state = fake({
      download: (report) => {
        report(0.5);
        report(1);
      },
    });

    await Effect.runPromise(
      capture(state.renderer, dir(), { onEvent: (event) => seen.push(event) })
    );

    expect(seen).toEqual([
      { percent: 50, type: "browser" },
      { percent: 100, type: "browser" },
      { type: "rendering" },
    ]);
  });

  it("makes sure a browser is there before every capture", async () => {
    const state = fake();
    const target = dir();

    await Effect.runPromise(capture(state.renderer, target));
    await Effect.runPromise(capture(state.renderer, target));

    expect(state.downloads).toBe(2);
  });

  it("keeps only the capture it just took", async () => {
    const target = dir();
    const state = fake();

    const first = await Effect.runPromise(capture(state.renderer, target));
    const second = await Effect.runPromise(capture(state.renderer, target));

    expect(readdirSync(target)).toEqual([path.basename(second.path)]);
    expect(first.path).not.toBe(second.path);
  });

  it("reports a composition the project does not have", async () => {
    const state = fake({
      onSelect: () => Promise.reject(new Error("No composition with id Main")),
    });

    const exit = await Effect.runPromiseExit(capture(state.renderer, dir()));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("No composition with id Main");
  });

  it("reports a render that threw rather than swallowing it", async () => {
    const state = fake({
      onRender: () => Promise.reject(new Error("Cannot find module ./missing")),
    });

    const exit = await Effect.runPromiseExit(capture(state.renderer, dir()));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("Cannot find module ./missing");
  });

  it("gives up on a scene whose delayRender never resolves", async () => {
    const state = fake({ onRender: () => new Promise(() => undefined) });

    const exit = await Effect.runPromiseExit(
      capture(state.renderer, dir(), { timeoutMs: 20 })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("did not render a frame in time");
  });
});
