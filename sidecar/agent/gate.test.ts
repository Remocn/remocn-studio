import { describe, expect, it } from "bun:test";
import { Effect, Fiber } from "effect";
import type { AgentEvent } from "@/shared/ipc";
import { makeGate, type PermissionGate } from "@/sidecar/agent/gate";
import { type PermissionVerdict, signatureOf } from "@/sidecar/agent/verdict";

const TURN = "turn-1";

const BASH: PermissionVerdict = {
  kind: "ask",
  reason: "bash",
  signature: signatureOf("Bash", "bun install"),
};

const PLAN: PermissionVerdict = {
  kind: "ask",
  reason: "plan",
  signature: signatureOf("ExitPlanMode", "1. Build it"),
};

const PAID: PermissionVerdict = {
  kind: "ask",
  reason: "outward",
  signature: "sound:s1",
};

function harness(gate: PermissionGate = makeGate(), turnId = TURN) {
  const events: AgentEvent[] = [];
  const order: string[] = [];
  const turn = gate.forTurn({
    applyMode: (mode) => Effect.sync(() => order.push(`mode:${mode}`)),
    emit: (event) => Effect.sync(() => events.push(event)),
    turnId,
  });

  const ask = (verdict: PermissionVerdict, id?: string) =>
    Effect.runFork(
      turn
        .ask({ id, input: {}, name: "Bash", verdict })
        .pipe(
          Effect.tap((answer) => Effect.sync(() => order.push(answer.kind)))
        )
    );

  return { ask, events, gate, order, turn };
}

function raised(events: AgentEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === "permission" ? [event.id] : []
  );
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("the one ask", () => {
  it("raises no card for an allow verdict", async () => {
    const { ask, events } = harness();

    expect(await Effect.runPromise(Fiber.join(ask({ kind: "allow" })))).toEqual(
      { always: false, kind: "allow" }
    );
    expect(events).toHaveLength(0);
  });

  it("raises a card and holds the caller until it is answered", async () => {
    const { ask, events, gate } = harness();

    const waiting = ask(BASH, "p1");
    await settled();

    expect(events).toEqual([
      { id: "p1", input: {}, name: "Bash", reason: "bash", type: "permission" },
    ]);
    expect(await Effect.runPromise(gate.answer("p1", "allow", null))).toBe(
      true
    );
    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      always: false,
      kind: "allow",
    });
  });

  it("knows nothing about an id it never asked about", async () => {
    const gate = makeGate();

    expect(await Effect.runPromise(gate.answer("ghost", "allow", null))).toBe(
      false
    );
  });

  it("skips the card for a signature always allowed before", async () => {
    const { ask, events, gate } = harness();

    const first = ask(BASH, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "always", null));
    expect(await Effect.runPromise(Fiber.join(first))).toEqual({
      always: true,
      kind: "allow",
    });

    expect(await Effect.runPromise(Fiber.join(ask(BASH, "p2")))).toEqual({
      always: false,
      kind: "allow",
    });
    expect(raised(events)).toEqual(["p1"]);
  });

  it("remembers nothing from an allow once or a denial", async () => {
    const { ask, events, gate } = harness();

    const once = ask(BASH, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "allow", null));
    await Effect.runPromise(Fiber.join(once));

    const denied = ask(BASH, "p2");
    await settled();
    await Effect.runPromise(gate.answer("p2", "deny", null));
    expect(await Effect.runPromise(Fiber.join(denied))).toEqual({
      kind: "deny",
    });

    const again = ask(BASH, "p3");
    await settled();
    expect(raised(events)).toEqual(["p1", "p2", "p3"]);
    await Effect.runPromise(gate.answer("p3", "deny", null));
    await Effect.runPromise(Fiber.join(again));
  });

  it("neither consults nor remembers an outward ask", async () => {
    const { ask, events, gate } = harness();

    const first = ask(PAID, "s1");
    await settled();
    await Effect.runPromise(gate.answer("s1", "always", null));
    expect(await Effect.runPromise(Fiber.join(first))).toEqual({
      kind: "deny",
    });

    const second = ask(PAID, "s2");
    await settled();
    expect(raised(events)).toEqual(["s1", "s2"]);
    await Effect.runPromise(gate.answer("s2", "allow", null));
    expect(await Effect.runPromise(Fiber.join(second))).toEqual({
      always: false,
      kind: "allow",
    });
  });

  it("matches an answer sent from inside the emit", async () => {
    const gate = makeGate();
    const turn = gate.forTurn({
      applyMode: () => Effect.void,
      emit: (event) =>
        event.type === "permission"
          ? Effect.asVoid(gate.answer(event.id, "allow", null))
          : Effect.void,
      turnId: TURN,
    });

    expect(
      await Effect.runPromise(
        turn.ask({ input: {}, name: "Bash", verdict: BASH })
      )
    ).toEqual({ always: false, kind: "allow" });
  });

  it("applies the approved mode once, before the allow resolves", async () => {
    const { ask, gate, order } = harness();

    const waiting = ask(PLAN, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "allow", "acceptEdits"));
    await Effect.runPromise(Fiber.join(waiting));

    expect(order).toEqual(["mode:acceptEdits", "allow"]);
  });

  it("never applies a mode on a denial", async () => {
    const { ask, gate, order } = harness();

    const waiting = ask(PLAN, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "deny", "acceptEdits"));
    await Effect.runPromise(Fiber.join(waiting));

    expect(order).toEqual(["deny"]);
  });

  it("applies a mode only from a plan card", async () => {
    const { ask, gate, order } = harness();

    const waiting = ask(BASH, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "allow", "auto"));

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      always: false,
      kind: "allow",
    });
    expect(order).toEqual(["allow"]);
  });

  it("neither consults nor remembers a plan card", async () => {
    const { ask, events, gate, order } = harness();

    const first = ask(PLAN, "p1");
    await settled();
    await Effect.runPromise(gate.answer("p1", "always", "acceptEdits"));
    expect(await Effect.runPromise(Fiber.join(first))).toEqual({
      kind: "deny",
    });

    const second = ask(PLAN, "p2");
    await settled();
    expect(raised(events)).toEqual(["p1", "p2"]);
    await Effect.runPromise(gate.answer("p2", "allow", "acceptEdits"));
    await Effect.runPromise(Fiber.join(second));
    expect(order).toEqual(["deny", "mode:acceptEdits", "allow"]);
  });

  it("denies a card nobody ever answered", async () => {
    const { ask, gate } = harness(makeGate("10 millis"));

    expect(await Effect.runPromise(Fiber.join(ask(BASH, "p1")))).toEqual({
      kind: "deny",
    });
    expect(await Effect.runPromise(gate.answer("p1", "allow", null))).toBe(
      false
    );
  });

  it("denies only its own turn's cards when that turn is abandoned", async () => {
    const gate = makeGate();
    const mine = harness(gate, TURN);
    const theirs = harness(gate, "turn-2");

    const waiting = mine.ask(BASH, "p1");
    const other = theirs.ask(BASH, "p2");
    await settled();
    Effect.runSync(mine.turn.abandon);

    expect(await Effect.runPromise(Fiber.join(waiting))).toEqual({
      kind: "deny",
    });
    expect(await Effect.runPromise(gate.answer("p2", "allow", null))).toBe(
      true
    );
    expect(await Effect.runPromise(Fiber.join(other))).toEqual({
      always: false,
      kind: "allow",
    });
  });

  it("leaves nothing to answer once an ask is interrupted", async () => {
    const { ask, events, gate } = harness();

    const waiting = ask(BASH, "p1");
    await settled();
    expect(raised(events)).toEqual(["p1"]);
    await Effect.runPromise(Fiber.interrupt(waiting));

    expect(await Effect.runPromise(gate.answer("p1", "allow", null))).toBe(
      false
    );
  });
});
