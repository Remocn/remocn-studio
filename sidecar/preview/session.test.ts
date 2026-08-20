// @vitest-environment node

import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { openSession, type WarmInternals } from "./session";

const SERVE_URL = "http://127.0.0.1:51749/__remocn/render/index.html";

const MEASURED = {
  defaultCodec: "h264",
  durationInFrames: 120,
  fps: 30,
  height: 720,
  id: "Main",
  props: { title: "hello" },
  width: 1280,
};

const OPTIONS = {
  chromeMode: null,
  chromiumOptions: {},
  timeoutInMilliseconds: null,
};

interface Journal {
  closed: number;
  internals: WarmInternals;
  seeks: number[];
  steps: string[];
  taken: { height: number; output: string | null; width: number }[];
}

function fakes(
  overrides: {
    onSeek?: () => Promise<unknown>;
    onTake?: (output: string | null) => Promise<unknown>;
  } = {}
): Journal {
  const journal: Journal = {
    closed: 0,
    internals: {} as WarmInternals,
    seeks: [],
    steps: [],
    taken: [],
  };

  const page = {
    setViewport: async () => {
      journal.steps.push("setViewport");
      await Promise.resolve();
    },
  };

  journal.internals = {
    evaluate: async (options) => {
      const named = (options.pageFunction as { name?: string }).name ?? "?";
      journal.steps.push(`evaluate:${named}`);
      if (named === "prepareDesignAudit") {
        return await Promise.resolve({
          value: { candidates: [], findings: [], fingerprint: "frame-state" },
        });
      }
      if (named === "finishDesignContrast") {
        return await Promise.resolve({ value: [] });
      }
      return await Promise.resolve({ value: null });
    },
    openBrowser: async () => {
      journal.steps.push("openBrowser");
      return await Promise.resolve({
        close: async () => {
          journal.closed += 1;
          await Promise.resolve();
        },
        newPage: async () => {
          journal.steps.push("newPage");
          return await Promise.resolve(page);
        },
      });
    },
    seekToFrame: async (options) => {
      journal.seeks.push(options.frame as number);
      if (overrides.onSeek !== undefined) {
        return await overrides.onSeek();
      }
      return await Promise.resolve(null);
    },
    serialize: (data) => JSON.stringify(data),
    setPropsAndEnv: async () => {
      journal.steps.push("setPropsAndEnv");
      await Promise.resolve();
    },
    takeFrame: async (options) => {
      const output = options.output as string | null;
      journal.taken.push({
        height: options.height as number,
        output,
        width: options.width as number,
      });
      if (overrides.onTake !== undefined) {
        return await overrides.onTake(output);
      }
      return await Promise.resolve(
        options.wantsBuffer === true ? Buffer.from("png") : undefined
      );
    },
  };

  return journal;
}

const open = (journal: Journal) =>
  openSession({
    composition: "Main",
    internals: journal.internals,
    measured: MEASURED,
    options: OPTIONS,
    serveUrl: SERVE_URL,
    timeoutMs: 30_000,
  });

describe("openSession", () => {
  it("sizes the page before it navigates, as renderStill does", async () => {
    const journal = fakes();

    await Effect.runPromise(open(journal));

    expect(journal.steps).toEqual([
      "openBrowser",
      "newPage",
      "setViewport",
      "setPropsAndEnv",
      "evaluate:bundleMode",
    ]);
  });

  it("reports the composition it was opened for and its size", async () => {
    const session = await Effect.runPromise(open(fakes()));

    expect({
      composition: session.composition,
      height: session.height,
      width: session.width,
    }).toEqual({ composition: "Main", height: 720, width: 1280 });
  });

  it("navigates once, however many frames are captured", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.capture(10, "/tmp/a.png"));
    await Effect.runPromise(session.capture(25, "/tmp/b.png"));
    await Effect.runPromise(session.capture(40, "/tmp/c.png"));

    expect(journal.steps.filter((step) => step === "setPropsAndEnv")).toEqual([
      "setPropsAndEnv",
    ]);
    expect(journal.seeks).toEqual([10, 25, 40]);
    expect(journal.taken.map((shot) => shot.output)).toEqual([
      "/tmp/a.png",
      "/tmp/b.png",
      "/tmp/c.png",
    ]);
  });

  it("takes the frame at the composition's own resolution", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.capture(10, "/tmp/a.png"));

    expect(journal.taken[0]).toEqual({
      height: 720,
      output: "/tmp/a.png",
      width: 1280,
    });
  });

  it("audits and restores a frame before writing its visible snapshot", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    const audit = await Effect.runPromise(session.audit(20, "/tmp/design.png"));

    expect(audit).toEqual({ findings: [], fingerprint: "frame-state" });
    expect(journal.seeks).toEqual([20]);
    expect(journal.taken.map(({ output }) => output)).toEqual([
      null,
      "/tmp/design.png",
    ]);
    expect(journal.steps.slice(-3)).toEqual([
      "evaluate:prepareDesignAudit",
      "evaluate:finishDesignContrast",
      "evaluate:restoreDesignAudit",
    ]);
  });

  it("restores hidden text when the measurement capture fails", async () => {
    const journal = fakes({
      onTake: (output) =>
        output === null
          ? Promise.reject(new Error("measurement failed"))
          : Promise.resolve(),
    });
    const session = await Effect.runPromise(open(journal));

    const exit = await Effect.runPromiseExit(
      session.audit(20, "/tmp/design.png")
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(journal.steps.at(-1)).toBe("evaluate:restoreDesignAudit");
  });

  it("reports a seek that failed rather than writing nothing", async () => {
    const journal = fakes({
      onSeek: () => Promise.reject(new Error("Timed out seeking")),
    });
    const session = await Effect.runPromise(open(journal));

    const exit = await Effect.runPromiseExit(session.capture(10, "/tmp/a.png"));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("Timed out seeking");
    expect(journal.taken).toEqual([]);
  });

  it("closes the browser it opened", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.close);

    expect(journal.closed).toBe(1);
  });
});
