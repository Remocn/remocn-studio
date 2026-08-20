// @vitest-environment node
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { WarmInternals } from "./session";
import { captureSourcePage } from "./source";

describe("captureSourcePage", () => {
  it("captures the authoritative page at the deterministic viewport", async () => {
    const calls: unknown[] = [];
    const output = join(tmpdir(), `source-${crypto.randomUUID()}.png`);
    const internals = {
      openBrowser: async () => ({
        close: async () => calls.push("close"),
        newPage: async () => ({
          _client: () => ({
            send: (method: string, params: unknown) => {
              calls.push({ method, params });
              return Promise.resolve({
                data: Buffer.from("png-bytes").toString("base64"),
              });
            },
          }),
          evaluate: async () => undefined,
          goto: async (options: unknown) => calls.push(options),
          setViewport: async (viewport: unknown) => calls.push(viewport),
        }),
      }),
    } as unknown as WarmInternals;

    await Effect.runPromise(
      captureSourcePage({
        internals,
        options: {
          chromeMode: null,
          chromiumOptions: {},
          timeoutInMilliseconds: null,
        },
        output,
        timeoutMs: 30_000,
        url: "https://example.com/brand",
      })
    );

    expect(calls).toContainEqual({
      deviceScaleFactor: 1,
      height: 900,
      width: 1440,
    });
    expect(calls).toContainEqual({
      timeout: 30_000,
      url: "https://example.com/brand",
    });
    expect(await readFile(output, "utf8")).toBe("png-bytes");
    expect(calls.at(-1)).toBe("close");
  });

  it("unwraps the sized CDP response returned by Remotion", async () => {
    const output = join(tmpdir(), `source-${crypto.randomUUID()}.png`);
    const internals = {
      openBrowser: () =>
        Promise.resolve({
          close: () => Promise.resolve(),
          newPage: () =>
            Promise.resolve({
              _client: () => ({
                send: () =>
                  Promise.resolve({
                    value: {
                      data: Buffer.from("wrapped-png").toString("base64"),
                    },
                  }),
              }),
              evaluate: () => Promise.resolve(),
              goto: () => Promise.resolve(),
              setViewport: () => Promise.resolve(),
            }),
        }),
    } as unknown as WarmInternals;

    await Effect.runPromise(
      captureSourcePage({
        internals,
        options: {
          chromeMode: null,
          chromiumOptions: {},
          timeoutInMilliseconds: null,
        },
        output,
        timeoutMs: 30_000,
        url: "https://example.com/brand",
      })
    );

    expect(await readFile(output, "utf8")).toBe("wrapped-png");
  });
});
