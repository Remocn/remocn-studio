import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { fileURLToPath } from "node:url";
import { Effect, Fiber } from "effect";
import { guard, type Outlet, untilBroken } from "@/sidecar/pipes";

const PROBE = fileURLToPath(new URL("./pipes.probe.ts", import.meta.url));

class FakeOutlet extends EventEmitter implements Outlet {
  errored: Error | null = null;
}

function brokenPipe(): Error {
  return Object.assign(new Error("EPIPE: broken pipe, write"), {
    code: "EPIPE",
  });
}

async function probe(...flags: string[]) {
  const child = spawn(process.execPath, ["run", PROBE, ...flags], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let said = "";
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    said += chunk;
  });

  child.stdout.destroy();
  await once(child.stdout, "close");
  child.stdin.end("go\n");

  const [code] = await once(child, "close");
  return {
    code,
    report: JSON.parse(said) as { raised: string[]; reason: string | null },
  };
}

describe("the pipes, in the runtime the app ships", () => {
  it("is needed: bun raises a write into a closed stdout as an unhandled rejection", async () => {
    const { report } = await probe("--plain");

    expect(report.raised).toContain("EPIPE");
  });

  it("raises nothing once guarded, and the break still reads as a reason", async () => {
    const { code, report } = await probe();

    expect(code).toBe(0);
    expect(report).toEqual({ raised: [], reason: "the host closed stdout" });
  });
});

describe("guard", () => {
  it("leaves an error on the stream with somewhere to go", () => {
    const bare = new FakeOutlet();
    const guarded = new FakeOutlet();

    Effect.runSync(guard([guarded]));

    expect(() => bare.emit("error", brokenPipe())).toThrow("EPIPE");
    expect(() => guarded.emit("error", brokenPipe())).not.toThrow();
  });
});

describe("untilBroken", () => {
  it("answers with its reason when the stream errors", async () => {
    const outlet = new FakeOutlet();
    const waiting = Effect.runPromise(untilBroken(outlet, "the host closed"));

    outlet.emit("error", brokenPipe());

    expect(await waiting).toBe("the host closed");
  });

  it("answers at once for a stream that broke before anyone asked", async () => {
    const outlet = new FakeOutlet();
    outlet.errored = brokenPipe();

    expect(await Effect.runPromise(untilBroken(outlet, "already"))).toBe(
      "already"
    );
    expect(outlet.listenerCount("error")).toBe(0);
  });

  it("takes its listener back when the race is won elsewhere", async () => {
    const outlet = new FakeOutlet();
    const fiber = Effect.runFork(untilBroken(outlet, "never"));

    expect(outlet.listenerCount("error")).toBe(1);

    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(outlet.listenerCount("error")).toBe(0);
  });
});
