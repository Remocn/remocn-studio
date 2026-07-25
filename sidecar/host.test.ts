import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { SIDECAR_PROTOCOL, type SidecarFrame } from "@/shared/ipc";
import { make, SidecarChannel } from "@/sidecar/channel";
import { handlers } from "@/sidecar/handlers";
import {
  broken as brokenProjects,
  ProjectStore,
} from "@/sidecar/history/projects";
import { broken, HistoryStore } from "@/sidecar/history/store";
import { type Handlers, runHost } from "@/sidecar/host";

const FLUSH_MS = 80;

function harness(overrides?: Partial<Handlers<HistoryStore | ProjectStore>>) {
  const input = new PassThrough();
  const sent: SidecarFrame[] = [];
  const logged: string[] = [];

  const channel = make({
    input: createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input }),
    stderr: (line) => logged.push(line),
    stdout: (line) => sent.push(JSON.parse(line) as SidecarFrame),
  });

  const finished = Effect.runPromise(
    Effect.scoped(runHost({ ...handlers, ...overrides })).pipe(
      Effect.provideService(SidecarChannel, channel),
      Effect.provideService(
        HistoryStore,
        broken("history is not open in this harness")
      ),
      Effect.provideService(
        ProjectStore,
        brokenProjects("history is not open in this harness")
      )
    )
  );

  return {
    close: () => input.end(),
    finished,
    logged,
    push: (line: string) => input.write(`${line}\n`),
    sent,
  };
}

function settled() {
  return new Promise((resolve) => setTimeout(resolve, FLUSH_MS));
}

function request(id: string, method: string, params: unknown) {
  return JSON.stringify({ id, method, params, type: "request" });
}

function mine(sent: SidecarFrame[], id: string) {
  return sent.filter((frame) => "id" in frame && frame.id === id);
}

describe("runHost", () => {
  it("announces itself before answering anything", async () => {
    const host = harness();
    await settled();

    expect(host.sent).toEqual([
      { pid: process.pid, protocol: SIDECAR_PROTOCOL, type: "ready" },
    ]);

    host.close();
    await host.finished;
  });

  it("answers a request with a result", async () => {
    const host = harness();

    host.push(request("info-1", "sidecar.info", null));
    await settled();

    expect(host.sent).toContainEqual(
      expect.objectContaining({ id: "info-1", type: "result" })
    );

    host.close();
    await host.finished;
  });

  it("streams every chunk before the result", async () => {
    const host = harness();

    host.push(request("emit-1", "sidecar.emit", { count: 3, delayMs: 0 }));
    await settled();

    const frames = mine(host.sent, "emit-1");

    expect(frames.map((frame) => frame.type)).toEqual([
      "stream",
      "stream",
      "stream",
      "result",
    ]);
    expect(frames.at(-1)).toEqual({
      data: { elapsedMs: expect.any(Number), emitted: 3 },
      id: "emit-1",
      type: "result",
    });

    host.close();
    await host.finished;
  });

  it("cancels a request that is still running", async () => {
    const host = harness();

    host.push(request("emit-2", "sidecar.emit", { count: 500, delayMs: 20 }));
    await settled();
    host.push(JSON.stringify({ id: "emit-2", type: "cancel" }));
    await settled();

    expect(host.sent).toContainEqual({
      id: "emit-2",
      message: "cancelled",
      type: "error",
    });
    expect(host.sent.filter((frame) => frame.type === "result")).toHaveLength(
      0
    );

    host.close();
    await host.finished;
  });

  it("answers a permission card nobody is waiting on", async () => {
    const host = harness();

    host.push(
      request("perm-1", "claude.permission", { decision: "allow", id: "gone" })
    );
    await settled();

    expect(host.sent).toContainEqual({
      data: { matched: false },
      id: "perm-1",
      type: "result",
    });

    host.close();
    await host.finished;
  });

  it("reports a method it does not have", async () => {
    const host = harness();

    host.push(request("bad-1", "sidecar.nope", null));
    await settled();

    expect(host.sent).toContainEqual({
      id: "bad-1",
      message: "there is no method called sidecar.nope",
      type: "error",
    });

    host.close();
    await host.finished;
  });

  it("refuses a second request under the same id", async () => {
    const host = harness();

    host.push(request("dup", "sidecar.emit", { count: 500, delayMs: 20 }));
    await settled();
    host.push(request("dup", "sidecar.emit", { count: 1, delayMs: 0 }));
    await settled();

    expect(host.sent).toContainEqual({
      id: "dup",
      message: "request dup is already in flight",
      type: "error",
    });

    host.close();
    await host.finished;
  });

  it("refuses params the method does not accept", async () => {
    const host = harness();

    host.push(request("bad-params", "sidecar.emit", { count: "three" }));
    await settled();

    expect(mine(host.sent, "bad-params")).toHaveLength(1);
    expect(host.sent).toContainEqual(
      expect.objectContaining({ id: "bad-params", type: "error" })
    );

    host.close();
    await host.finished;
  });

  it("logs a line it cannot parse and keeps going", async () => {
    const host = harness();

    host.push("not json");
    host.push("");
    host.push(request("info-2", "sidecar.info", null));
    await settled();

    expect(host.logged).toContain(
      "dropped a frame it could not parse: not json"
    );
    expect(host.sent).toContainEqual(
      expect.objectContaining({ id: "info-2", type: "result" })
    );

    host.close();
    await host.finished;
  });

  it("turns a handler that fails into an error frame", async () => {
    const host = harness({
      "sidecar.info": () => Effect.die(new Error("no info today")),
    });

    host.push(request("info-3", "sidecar.info", null));
    await settled();

    expect(host.sent).toContainEqual({
      id: "info-3",
      message: "no info today",
      type: "error",
    });

    host.close();
    await host.finished;
  });

  it("interrupts what is still running when the host closes stdin", async () => {
    const interrupted = vi.fn();
    const host = harness({
      "sidecar.emit": () =>
        Effect.never.pipe(
          Effect.onInterrupt(() => Effect.sync(() => interrupted()))
        ),
    });

    host.push(request("emit-3", "sidecar.emit", { count: 1, delayMs: 0 }));
    await settled();
    host.close();
    await host.finished;

    expect(interrupted).toHaveBeenCalledTimes(1);
  });
});
