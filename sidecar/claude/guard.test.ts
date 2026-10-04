import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import type { AgentEvent, SessionMode } from "@/shared/ipc";
import { makeGate } from "@/sidecar/agent/gate";
import { gateHooks, permissionGuard } from "@/sidecar/claude/guard";

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
        permissions: gate.forTurn({
          applyMode: (mode) => Effect.sync(() => approvals.push(mode)),
          emit: (event) => Effect.sync(() => events.push(event)),
          turnId: TURN,
        }),
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

  it("denies rather than hangs when the turn is aborted mid-card", async () => {
    const { events, gate, guard } = harness();
    const controller = new AbortController();

    const call = guard("Bash", { command: "sleep 100" }, asked(controller, 1));

    await settled();
    controller.abort();

    expect(await call).toMatchObject({ behavior: "deny" });
    expect(
      await Effect.runPromise(gate.answer(pendingId(events), "allow", null))
    ).toBe(false);
  });

  it("denies a call whose turn was aborted before it was asked, with no card", async () => {
    const { events, guard } = harness();
    const controller = new AbortController();
    controller.abort();

    const result = await guard(
      "Read",
      { file_path: `${process.cwd()}/package.json` },
      asked(controller, 1)
    );
    expect(result).toMatchObject({ behavior: "deny" });

    expect(
      await guard("Bash", { command: "bun install" }, asked(controller, 2))
    ).toMatchObject({ behavior: "deny" });

    await settled();
    expect(events).toHaveLength(0);
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

describe("gateHooks", () => {
  function hookFor(mode: SessionMode) {
    const hooks = gateHooks(mode, process.cwd());
    const hook = hooks?.PreToolUse?.[0]?.hooks?.[0];
    if (hook === undefined) {
      throw new Error(`no PreToolUse hook for ${mode}`);
    }
    return (toolName: string, toolInput: unknown) =>
      hook(
        {
          hook_event_name: "PreToolUse",
          tool_input: toolInput,
          tool_name: toolName,
        } as never,
        "tool-1",
        { signal: new AbortController().signal }
      );
  }

  function decisionOf(output: Awaited<ReturnType<ReturnType<typeof hookFor>>>) {
    const specific = (output as { hookSpecificOutput?: unknown })
      .hookSpecificOutput as { permissionDecision?: string } | undefined;
    return specific?.permissionDecision ?? null;
  }

  // Claude Code's own classifier approves a command it likes before
  // `canUseTool` is ever consulted, so without this hook a Bash call in
  // `acceptEdits` ran with the gate never seeing it. Measured against the real
  // CLI: `ls src/videos` produced a tool row and no card at all.
  it("forces Bash into the gate in acceptEdits, where the invariant is absolute", async () => {
    const decision = await hookFor("acceptEdits")("Bash", {
      command: "ls src/videos",
    });

    expect(decisionOf(decision)).toBe("ask");
  });

  it("forces a read outside the folder into the gate in plan", async () => {
    const decision = await hookFor("plan")("Read", {
      file_path: "/etc/hosts",
    });

    expect(decisionOf(decision)).toBe("ask");
  });

  it("leaves a file tool inside the folder to run untouched", async () => {
    const decision = await hookFor("acceptEdits")("Read", {
      file_path: `${process.cwd()}/package.json`,
    });

    expect(decisionOf(decision)).toBeNull();
  });

  it("passes an event that is not a PreToolUse straight through", async () => {
    const hooks = gateHooks("acceptEdits", process.cwd());
    const hook = hooks?.PreToolUse?.[0]?.hooks?.[0];

    const output = await hook?.(
      { hook_event_name: "PostToolUse", tool_name: "Bash" } as never,
      "tool-1",
      { signal: new AbortController().signal }
    );

    expect(decisionOf(output as never)).toBeNull();
  });

  // `auto` keeps the classifier deciding first — that is the trade the mode is,
  // and a hook there would quietly turn it into `acceptEdits`.
  it("installs no hook in auto", () => {
    expect(gateHooks("auto", process.cwd())).toBeUndefined();
  });
});
