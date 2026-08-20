// @vitest-environment node
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit, Scope } from "effect";
import { describe, expect, it } from "vitest";
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
    cwd: "/videos/promo",
    design: {
      check: () => Promise.reject(new Error("unused")),
    },
    library: {
      list: () => Promise.resolve([]),
      save: () => Promise.reject(new Error("unused")),
    },
    pipeline: {
      requestSource: () => Promise.reject(new Error("unused")),
      setStage: () => Promise.reject(new Error("unused")),
      start: () => Promise.resolve([{ stage: "analysis", status: "active" }]),
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
