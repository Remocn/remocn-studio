import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { causeMessage } from "@/lib/error-message";
import { cancelSidecarRequest, requestSidecar } from "@/lib/studio/sidecar";
import type { EmitChunk } from "@/shared/ipc";

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

function channelId(value: unknown): number {
  const channel = value as { id: number; toJSON: () => string };
  expect(channel.toJSON()).toBe(`__CHANNEL__:${channel.id}`);
  return channel.id;
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("requestSidecar", () => {
  it("hands the channel to the core and forwards every chunk", async () => {
    let stream = 0;
    let finish: (result: unknown) => void = () => undefined;

    mockIPC((cmd, args) => {
      expect(cmd).toBe("sidecar_request");
      const payload = args as Record<string, unknown>;
      expect(payload.id).toBe("emit-1");
      expect(payload.method).toBe("sidecar.emit");
      expect(payload.params).toEqual({ count: 2, delayMs: 0 });
      stream = channelId(payload.onStream);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    const chunks: EmitChunk[] = [];
    const answer = Effect.runPromise(
      requestSidecar({
        id: "emit-1",
        method: "sidecar.emit",
        onStream: (chunk) => chunks.push(chunk),
        params: { count: 2, delayMs: 0 },
      })
    );

    await tick();

    internals().runCallback(stream, {
      index: 0,
      message: { index: 0, token: "one", total: 2 },
    });
    internals().runCallback(stream, {
      index: 1,
      message: { index: 1, token: "two", total: 2 },
    });

    expect(chunks.map((chunk) => chunk.token)).toEqual(["one", "two"]);

    finish({ elapsedMs: 3, emitted: 2 });
    await expect(answer).resolves.toEqual({ elapsedMs: 3, emitted: 2 });
  });

  it("drops a chunk that does not match the method's schema", async () => {
    let stream = 0;
    let finish: (result: unknown) => void = () => undefined;

    mockIPC((_cmd, args) => {
      stream = channelId((args as Record<string, unknown>).onStream);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    const chunks: EmitChunk[] = [];
    const answer = Effect.runPromise(
      requestSidecar({
        id: "emit-2",
        method: "sidecar.emit",
        onStream: (chunk) => chunks.push(chunk),
        params: { count: 1, delayMs: 0 },
      })
    );

    await tick();
    internals().runCallback(stream, { index: 0, message: { token: 42 } });

    expect(chunks).toEqual([]);

    finish({ elapsedMs: 1, emitted: 1 });
    await answer;
  });

  it("keeps the message the core sent in the error channel", async () => {
    mockIPC(() => Promise.reject("the sidecar is not running"));

    const exit = await Effect.runPromiseExit(
      requestSidecar({ id: "info-1", method: "sidecar.info", params: null })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toBe("the sidecar is not running");
    }
  });

  it("fails when the core answers with something off-contract", async () => {
    mockIPC(() => ({ emitted: "lots" }));

    const exit = await Effect.runPromiseExit(
      requestSidecar({
        id: "emit-3",
        method: "sidecar.emit",
        params: { count: 1, delayMs: 0 },
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("cancelSidecarRequest", () => {
  it("names the request it wants stopped", async () => {
    const seen: unknown[] = [];
    mockIPC((cmd, args) => {
      seen.push([cmd, args]);
      return null;
    });

    await Effect.runPromise(cancelSidecarRequest("emit-1"));

    expect(seen).toEqual([["sidecar_cancel", { id: "emit-1" }]]);
  });
});
