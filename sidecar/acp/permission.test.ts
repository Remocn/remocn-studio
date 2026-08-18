import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@/shared/ipc";
import { makeGate } from "../agent/gate";
import { answerPermission, reviewAcp } from "./permission";

const CWD = "/videos/promo";

const OPTIONS = [
  { kind: "allow_once", name: "Allow", optionId: "allow" },
  { kind: "allow_always", name: "Always allow", optionId: "always" },
  { kind: "reject_once", name: "Deny", optionId: "reject" },
];

function harness() {
  const gate = makeGate();
  const events: AgentEvent[] = [];

  return {
    events,
    gate,
    options: {
      cwd: CWD,
      emit: (event: AgentEvent) => Effect.sync(() => events.push(event)),
      gate,
      turnId: "turn-1",
    },
  };
}

function askedId(events: AgentEvent[]): string {
  const event = events.find((candidate) => candidate.type === "permission");
  if (event === undefined || event.type !== "permission") {
    throw new Error("no permission was raised");
  }
  return event.id;
}

describe("reviewAcp", () => {
  it("always asks for execute, which is what Bash means here", () => {
    expect(
      reviewAcp(CWD, { kind: "execute", title: "Run rm -rf" })
    ).toMatchObject({ reason: "bash" });
  });

  it("runs file work inside the folder without a card", () => {
    expect(
      reviewAcp(CWD, {
        kind: "read",
        locations: [{ path: `${CWD}/src/Main.tsx` }],
      })
    ).toBeNull();
  });

  it("asks about a location outside the folder", () => {
    expect(
      reviewAcp(CWD, {
        kind: "edit",
        locations: [{ path: "/etc/hosts" }],
      })
    ).toMatchObject({ reason: "outside" });
  });

  it("asks about a kind it does not recognise, and a call with no locations", () => {
    expect(
      reviewAcp(CWD, { kind: "other", title: "Do something" })
    ).toMatchObject({ reason: "tool" });
    expect(reviewAcp(CWD, { kind: "edit" })).toMatchObject({ reason: "tool" });
  });
});

describe("answerPermission", () => {
  it("allows in-folder file work without raising a card", async () => {
    const { events, options } = harness();

    const answer = await answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "read",
        locations: [{ path: `${CWD}/package.json` }],
      },
    });

    expect(answer.outcome).toEqual({ optionId: "allow", outcome: "selected" });
    expect(events).toHaveLength(0);
  });

  it("raises a card for execute and picks the allow option once answered", async () => {
    const { events, gate, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "execute",
        rawInput: { command: "bun add remotion" },
        title: "Run bun add",
      },
    });

    await new Promise((settle) => setTimeout(settle, 10));
    await Effect.runPromise(gate.answer(askedId(events), "allow", null));

    expect((await pending).outcome).toEqual({
      optionId: "allow",
      outcome: "selected",
    });
  });

  it("remembers an always and never asks that signature again", async () => {
    const { events, gate, options } = harness();

    const first = answerPermission(options, {
      options: OPTIONS,
      toolCall: { kind: "execute", title: "Run bun install" },
    });
    await new Promise((settle) => setTimeout(settle, 10));
    await Effect.runPromise(gate.answer(askedId(events), "always", null));
    expect((await first).outcome).toEqual({
      optionId: "always",
      outcome: "selected",
    });

    const second = await answerPermission(options, {
      options: OPTIONS,
      toolCall: { kind: "execute", title: "Run bun install" },
    });

    expect(second.outcome).toEqual({ optionId: "allow", outcome: "selected" });
    expect(events.filter((event) => event.type === "permission")).toHaveLength(
      1
    );
  });

  it("picks the reject option on a denial", async () => {
    const { events, gate, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: { kind: "execute", title: "Run rm -rf /" },
    });

    await new Promise((settle) => setTimeout(settle, 10));
    await Effect.runPromise(gate.answer(askedId(events), "deny", null));

    expect((await pending).outcome).toEqual({
      optionId: "reject",
      outcome: "selected",
    });
  });

  it("cancels rather than inventing an option the agent did not offer", async () => {
    const { options } = harness();

    const answer = await answerPermission(options, {
      options: [],
      toolCall: {
        kind: "read",
        locations: [{ path: `${CWD}/src/Main.tsx` }],
      },
    });

    expect(answer.outcome).toEqual({ outcome: "cancelled" });
  });
});
