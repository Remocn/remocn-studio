import { Effect, Fiber } from "effect";
import { describe, expect, it } from "vitest";
import type { ClaudeEvent } from "@/shared/ipc";
import { makeGate, permissionGuard } from "@/sidecar/claude/gate";
import { signatureOf } from "@/sidecar/claude/permission";

const TURN = "turn-1";

function ask(id: string, signature = signatureOf("Bash", "bun install")) {
  return { id, signature, turnId: TURN };
}

describe("makeGate", () => {
  it("holds the caller until an answer arrives", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    expect(await Effect.runPromise(gate.answer("p1", "allow"))).toBe(true);

    expect(await Effect.runPromise(Fiber.join(waiting))).toBe("allow");
  });

  it("knows nothing about an id it never asked about", async () => {
    const gate = makeGate();

    expect(await Effect.runPromise(gate.answer("ghost", "allow"))).toBe(false);
  });

  it("remembers a signature only when told to always allow", async () => {
    const gate = makeGate();
    const signature = signatureOf("Bash", "bun install");

    const once = Effect.runFork(gate.wait(ask("p1", signature)));
    await Effect.runPromise(gate.answer("p1", "allow"));
    await Effect.runPromise(Fiber.join(once));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(false);

    const again = Effect.runFork(gate.wait(ask("p2", signature)));
    await Effect.runPromise(gate.answer("p2", "always"));
    await Effect.runPromise(Fiber.join(again));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(true);
  });

  it("never remembers a denial", async () => {
    const gate = makeGate();
    const signature = signatureOf("Bash", "rm -rf /");

    const waiting = Effect.runFork(gate.wait(ask("p1", signature)));
    await Effect.runPromise(gate.answer("p1", "deny"));
    await Effect.runPromise(Fiber.join(waiting));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(false);
  });

  it("denies what is still pending when its turn is abandoned", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    await Effect.runPromise(gate.abandon(TURN));

    expect(await Effect.runPromise(Fiber.join(waiting))).toBe("deny");
  });

  it("can be abandoned synchronously, from the stream teardown", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    Effect.runSync(gate.abandon(TURN));

    expect(await Effect.runPromise(Fiber.join(waiting))).toBe("deny");
  });

  it("denies a card nobody ever answered", async () => {
    const gate = makeGate("10 millis");

    const waiting = Effect.runFork(gate.wait(ask("p1")));

    expect(await Effect.runPromise(Fiber.join(waiting))).toBe("deny");
    expect(await Effect.runPromise(gate.answer("p1", "allow"))).toBe(false);
  });

  it("leaves another turn's cards alone", async () => {
    const gate = makeGate();

    const mine = Effect.runFork(gate.wait(ask("p1")));
    const theirs = Effect.runFork(
      gate.wait({ ...ask("p2"), turnId: "turn-2" })
    );

    await Effect.runPromise(gate.abandon(TURN));
    expect(await Effect.runPromise(Fiber.join(mine))).toBe("deny");

    expect(await Effect.runPromise(gate.answer("p2", "allow"))).toBe(true);
    expect(await Effect.runPromise(Fiber.join(theirs))).toBe("allow");
  });
});

describe("permissionGuard", () => {
  function harness() {
    const gate = makeGate();
    const events: ClaudeEvent[] = [];

    return {
      events,
      gate,
      guard: permissionGuard({
        cwd: process.cwd(),
        emit: (event) => Effect.sync(() => events.push(event)),
        gate,
        turnId: TURN,
      }),
    };
  }

  function pendingId(events: ClaudeEvent[]): string {
    const event = events.find((candidate) => candidate.type === "permission");
    if (event === undefined || event.type !== "permission") {
      throw new Error("no permission was raised");
    }
    return event.id;
  }

  async function settled() {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  function asked(controller: AbortController, call: number) {
    return {
      requestId: `r${call}`,
      signal: controller.signal,
      toolUseID: `t${call}`,
    };
  }

  it("runs a file tool inside the folder without raising a card", async () => {
    const { events, guard } = harness();

    const result = await guard(
      "Read",
      { file_path: `${process.cwd()}/package.json` },
      asked(new AbortController(), 1)
    );

    expect(result).toEqual({ behavior: "allow" });
    expect(events).toHaveLength(0);
  });

  it("raises one card for Bash and allows the call once answered", async () => {
    const { events, gate, guard } = harness();
    const controller = new AbortController();

    const call = guard(
      "Bash",
      { command: "bun add remotion" },
      asked(controller, 1)
    );

    await settled();
    expect(events).toHaveLength(1);

    await Effect.runPromise(gate.answer(pendingId(events), "allow"));

    expect(await call).toEqual({ behavior: "allow" });
  });

  it("turns a denial into a message the agent can carry on from", async () => {
    const { events, gate, guard } = harness();
    const controller = new AbortController();

    const call = guard("Bash", { command: "rm -rf /" }, asked(controller, 1));

    await settled();
    await Effect.runPromise(gate.answer(pendingId(events), "deny"));

    const result = await call;

    expect(result).toMatchObject({ behavior: "deny" });
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("denied this Bash call")
    );
  });

  it("skips the card for a command already allowed this session", async () => {
    const { events, gate, guard } = harness();
    const controller = new AbortController();

    const first = guard(
      "Bash",
      { command: "bun install" },
      asked(controller, 1)
    );

    await settled();
    await Effect.runPromise(gate.answer(pendingId(events), "always"));
    await first;

    const second = await guard(
      "Bash",
      { command: "bun install" },
      asked(controller, 2)
    );

    expect(second).toEqual({ behavior: "allow" });
    expect(events).toHaveLength(1);
  });

  it("denies rather than hangs when the turn is aborted mid-card", async () => {
    const { guard } = harness();
    const controller = new AbortController();

    const call = guard("Bash", { command: "sleep 100" }, asked(controller, 1));

    await settled();
    controller.abort();

    expect(await call).toMatchObject({ behavior: "deny" });
  });
});
