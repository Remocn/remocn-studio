import { Effect, Fiber } from "effect";
import { describe, expect, it } from "vitest";
import { makeGate } from "@/sidecar/agent/gate";
import { signatureOf } from "@/sidecar/claude/permission";

const TURN = "turn-1";

function ask(id: string, signature = signatureOf("Bash", "bun install")) {
  return { id, signature, turnId: TURN };
}

describe("makeGate", () => {
  it("holds the caller until an answer arrives", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    expect(await Effect.runPromise(gate.answer("p1", "allow", null))).toBe(
      true
    );

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      decision: "allow",
      mode: null,
    });
  });

  it("knows nothing about an id it never asked about", async () => {
    const gate = makeGate();

    expect(await Effect.runPromise(gate.answer("ghost", "allow", null))).toBe(
      false
    );
  });

  it("remembers a signature only when told to always allow", async () => {
    const gate = makeGate();
    const signature = signatureOf("Bash", "bun install");

    const once = Effect.runFork(gate.wait(ask("p1", signature)));
    await Effect.runPromise(gate.answer("p1", "allow", null));
    await Effect.runPromise(Fiber.join(once));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(false);

    const again = Effect.runFork(gate.wait(ask("p2", signature)));
    await Effect.runPromise(gate.answer("p2", "always", null));
    await Effect.runPromise(Fiber.join(again));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(true);
  });

  it("never remembers a denial", async () => {
    const gate = makeGate();
    const signature = signatureOf("Bash", "rm -rf /");

    const waiting = Effect.runFork(gate.wait(ask("p1", signature)));
    await Effect.runPromise(gate.answer("p1", "deny", null));
    await Effect.runPromise(Fiber.join(waiting));

    expect(await Effect.runPromise(gate.remembers(signature))).toBe(false);
  });

  it("denies what is still pending when its turn is abandoned", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    await Effect.runPromise(gate.abandon(TURN));

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      decision: "deny",
      mode: null,
    });
  });

  it("can be abandoned synchronously, from the stream teardown", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(gate.wait(ask("p1")));
    Effect.runSync(gate.abandon(TURN));

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      decision: "deny",
      mode: null,
    });
  });

  it("denies a card nobody ever answered", async () => {
    const gate = makeGate("10 millis");

    const waiting = Effect.runFork(gate.wait(ask("p1")));

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      decision: "deny",
      mode: null,
    });
    expect(await Effect.runPromise(gate.answer("p1", "allow", null))).toBe(
      false
    );
  });

  it("hands the caller the mode its answer was given with", async () => {
    const gate = makeGate();

    const waiting = Effect.runFork(
      gate.wait(ask("p1", signatureOf("ExitPlanMode", "1. Build it")))
    );
    await Effect.runPromise(gate.answer("p1", "allow", "acceptEdits"));

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      decision: "allow",
      mode: "acceptEdits",
    });
  });

  it("leaves another turn's cards alone", async () => {
    const gate = makeGate();

    const mine = Effect.runFork(gate.wait(ask("p1")));
    const theirs = Effect.runFork(
      gate.wait({ ...ask("p2"), turnId: "turn-2" })
    );

    await Effect.runPromise(gate.abandon(TURN));
    expect(await Effect.runPromise(Fiber.join(mine))).toEqual({
      decision: "deny",
      mode: null,
    });

    expect(await Effect.runPromise(gate.answer("p2", "allow", null))).toBe(
      true
    );
    expect(await Effect.runPromise(Fiber.join(theirs))).toEqual({
      decision: "allow",
      mode: null,
    });
  });
});
