import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit, Scope } from "effect";
import type { TurnTools } from "./execute";
import { makeGateway } from "./gateway";
import { connectGateway } from "./host";
import { TOOLS_SOCKET_ENV, TOOLS_TURN_ENV } from "./protocol";

const TURN = "turn-1";

function socketPath(): string {
  return join(
    tmpdir(),
    `remocn-tools-test-${randomBytes(6).toString("hex")}.sock`
  );
}

function tools(): TurnTools {
  return {
    connections: { usable: () => Promise.resolve([]) },
    cwd: "/videos/promo",
    design: {
      check: () => Promise.reject(new Error("unused")),
      sources: () => Promise.resolve([]),
    },
    library: {
      list: () => Promise.resolve([]),
      save: () => Promise.reject(new Error("unused")),
    },
    moodboard: {
      find: () => Promise.resolve(null),
      save: () => Promise.reject(new Error("unused")),
    },
    pipeline: {
      brief: () => null,
      requestSource: () => Promise.reject(new Error("unused")),
      setStage: () => Promise.reject(new Error("unused")),
      start: () => Promise.resolve([{ stage: "analysis", status: "active" }]),
    },
    stock: {
      search: () => Promise.reject(new Error("unused")),
    },
  };
}

async function serving(gatewayTools: TurnTools, path: string) {
  const gateway = makeGateway(() => undefined, path);
  const scope = Effect.runSync(Scope.make());

  await Effect.runPromise(
    Scope.provide(gateway.serving(TURN, gatewayTools), scope)
  );

  return {
    gateway,
    release: () => Effect.runPromise(Scope.close(scope, Exit.void)),
  };
}

describe("makeGateway", () => {
  it("answers a call from a connected host and names the turn's transport", async () => {
    const path = socketPath();
    const { gateway, release } = await serving(tools(), path);

    const transport = gateway.transport("remocn-library", TURN);
    expect(transport.env[TOOLS_SOCKET_ENV]).toBe(path);
    expect(transport.env[TOOLS_TURN_ENV]).toBe(TURN);
    expect(transport.args).toContain("remocn-library");

    const link = await connectGateway(path, TURN, "remocn-library");

    const started = performance.now();
    const answer = await link.ask("list_assets", {});
    const elapsed = performance.now() - started;

    expect(answer).toEqual({ isError: false, text: "The library is empty." });
    expect(elapsed).toBeLessThan(50);

    link.end();
    await release();
  });

  it("refuses a turn it is not serving", async () => {
    const path = socketPath();
    const { release } = await serving(tools(), path);

    const link = await connectGateway(path, "turn-ghost", "remocn-library");
    const answer = await link.ask("list_assets", {});

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain("no longer running");

    link.end();
    await release();
  });

  it("stops serving a turn when its scope closes", async () => {
    const path = socketPath();
    const { release } = await serving(tools(), path);
    const link = await connectGateway(path, TURN, "remocn-pipeline");

    expect((await link.ask("start_video_pipeline", {})).isError).toBe(false);

    await release();

    const after = await link.ask("start_video_pipeline", {});
    expect(after.isError).toBe(true);
    expect(after.text).toContain("no longer running");

    link.end();
  });

  it("keeps serving the next turn of a chat when the stopped one lets go after it started", async () => {
    const path = socketPath();
    const gateway = makeGateway(() => undefined, path);
    const stopped = Effect.runSync(Scope.make());
    const next = Effect.runSync(Scope.make());

    await Effect.runPromise(
      Scope.provide(gateway.serving(TURN, tools()), stopped)
    );
    await Effect.runPromise(
      Scope.provide(gateway.serving(TURN, tools()), next)
    );
    await Effect.runPromise(Scope.close(stopped, Exit.void));

    const answer = await gateway.ask("remocn-library", TURN)("list_assets", {});
    expect(answer).toEqual({ isError: false, text: "The library is empty." });

    await Effect.runPromise(Scope.close(next, Exit.void));

    const after = await gateway.ask("remocn-library", TURN)("list_assets", {});
    expect(after.isError).toBe(true);
  });

  it("refuses a server it does not carry", async () => {
    const path = socketPath();
    const { release } = await serving(tools(), path);

    const link = await connectGateway(path, TURN, "remocn-imaginary");
    const answer = await link.ask("list_assets", {});

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain("no tool server called remocn-imaginary");

    link.end();
    await release();
  });

  it("settles what is pending when the sidecar goes away", async () => {
    const path = socketPath();
    const slow = tools();
    const { release } = await serving(
      {
        ...slow,
        library: {
          list: () => new Promise(() => undefined),
          save: () => Promise.reject(new Error("unused")),
        },
      },
      path
    );

    const link = await connectGateway(path, TURN, "remocn-library");
    const hanging = link.ask("list_assets", {});

    link.end();

    expect(await hanging).toEqual({
      isError: true,
      text: "The studio went away before this call was answered.",
    });

    await release();
  });
});

describe("readiness tool lifecycle", () => {
  it("forwards progress and cancels the actual design operation", async () => {
    const path = socketPath();
    const base = tools();
    let cancelled = false;
    const { release } = await serving(
      {
        ...base,
        design: {
          ...base.design,
          check: (_input, execution) =>
            new Promise((_resolve, reject) => {
              execution?.signal?.addEventListener(
                "abort",
                () => {
                  cancelled = true;
                  reject(new Error("cancelled"));
                },
                { once: true }
              );
              execution?.progress?.("frames", 2, 10);
            }),
        },
      },
      path
    );
    const link = await connectGateway(path, TURN, "remocn-design");
    const controller = new AbortController();
    const progress: string[] = [];
    try {
      const answer = await link.ask(
        "design_check",
        { mode: "full" },
        {
          progress: (stage) => {
            progress.push(stage);
            controller.abort();
          },
          signal: controller.signal,
        }
      );
      expect(progress).toEqual(["frames"]);
      expect(cancelled).toBe(true);
      expect(answer.isError).toBe(true);
    } finally {
      link.end();
      await release();
    }
  });
});

it("cancels a running sound tool when its turn scope closes", async () => {
  const path = socketPath();
  let started: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let aborted = false;
  const gatewayTools = tools();
  const { release } = await serving(
    {
      ...gatewayTools,
      sounds: {
        generate: (_request, execution) =>
          new Promise<string>((_resolve, reject) => {
            execution?.signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new Error("The turn stopped."));
              },
              { once: true }
            );
            started();
          }),
        status: () => Promise.resolve("unused"),
      },
    },
    path
  );
  const link = await connectGateway(path, TURN, "remocn-library");
  const answer = link.ask("generate_sound_effect", {
    connectionId: "cn_1",
    sounds: [{ name: "Door", text: "Door closes" }],
  });
  await ready;
  await release();
  expect((await answer).isError).toBe(true);
  expect(aborted).toBe(true);
  link.end();
});

describe("the in-process link", () => {
  it("answers a call without a socket or a child", async () => {
    const { gateway, release } = await serving(tools(), socketPath());

    const answer = await gateway.ask("remocn-library", TURN)("list_assets", {});

    expect(answer).toEqual({ isError: false, text: "The library is empty." });
    await release();
  });

  it("refuses once the turn has ended", async () => {
    const { gateway, release } = await serving(tools(), socketPath());
    await release();

    const answer = await gateway.ask("remocn-library", TURN)("list_assets", {});

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain("no longer running");
  });

  it("aborts a running call when the turn ends and when the caller does", async () => {
    let aborted = 0;
    const waiting = (_request: unknown, execution?: { signal?: AbortSignal }) =>
      new Promise<string>((_resolve, reject) => {
        execution?.signal?.addEventListener(
          "abort",
          () => {
            aborted += 1;
            reject(new Error("The turn stopped."));
          },
          { once: true }
        );
      });
    const soundful = {
      ...tools(),
      sounds: { generate: waiting, status: () => Promise.resolve("unused") },
    };
    const request = {
      connectionId: "cn_1",
      sounds: [{ name: "Door", text: "Door closes" }],
    };

    const ended = await serving(soundful, socketPath());
    const first = ended.gateway.ask("remocn-library", TURN)(
      "generate_sound_effect",
      request
    );
    await ended.release();

    const cancelled = await serving(soundful, socketPath());
    const controller = new AbortController();
    const second = cancelled.gateway.ask("remocn-library", TURN)(
      "generate_sound_effect",
      request,
      { signal: controller.signal }
    );
    controller.abort();

    expect((await first).isError).toBe(true);
    expect((await second).isError).toBe(true);
    expect(aborted).toBe(2);
    await cancelled.release();
  });
});
