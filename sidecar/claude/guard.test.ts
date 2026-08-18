import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { AgentEvent, SessionMode } from "@/shared/ipc";
import { makeGate } from "@/sidecar/agent/gate";
import { permissionGuard } from "@/sidecar/claude/guard";

const TURN = "turn-1";

describe("permissionGuard", () => {
  function harness() {
    const gate = makeGate();
    const events: AgentEvent[] = [];
    const approvals: SessionMode[] = [];

    return {
      approvals,
      events,
      gate,
      guard: permissionGuard({
        cwd: process.cwd(),
        emit: (event) => Effect.sync(() => events.push(event)),
        gate,
        onApprove: (mode) => Effect.sync(() => approvals.push(mode)),
        turnId: TURN,
      }),
    };
  }

  function pendingId(events: AgentEvent[]): string {
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

    await Effect.runPromise(gate.answer(pendingId(events), "allow", null));

    expect(await call).toEqual({ behavior: "allow" });
  });

  it("turns a denial into a message the agent can carry on from", async () => {
    const { events, gate, guard } = harness();
    const controller = new AbortController();

    const call = guard("Bash", { command: "rm -rf /" }, asked(controller, 1));

    await settled();
    await Effect.runPromise(gate.answer(pendingId(events), "deny", null));

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
    await Effect.runPromise(gate.answer(pendingId(events), "always", null));
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

  it("raises a plan card and switches the mode the plan was approved into", async () => {
    const { approvals, events, gate, guard } = harness();

    const call = guard(
      "ExitPlanMode",
      { plan: "1. Build the title card" },
      asked(new AbortController(), 1)
    );

    await settled();
    expect(events.at(0)).toMatchObject({
      input: { plan: "1. Build the title card" },
      name: "ExitPlanMode",
      reason: "plan",
    });

    await Effect.runPromise(
      gate.answer(pendingId(events), "allow", "acceptEdits")
    );

    expect(await call).toEqual({ behavior: "allow" });
    expect(approvals).toEqual(["acceptEdits"]);
  });

  it("sends a plan back to be revised without changing the mode", async () => {
    const { approvals, events, gate, guard } = harness();

    const call = guard(
      "ExitPlanMode",
      { plan: "1. Rewrite everything" },
      asked(new AbortController(), 1)
    );

    await settled();
    await Effect.runPromise(gate.answer(pendingId(events), "deny", null));

    const result = await call;

    expect(result).toMatchObject({ behavior: "deny" });
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("Stay in plan mode")
    );
    expect(approvals).toEqual([]);
  });
});
