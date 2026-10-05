import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import {
  type AgentEvent,
  PLUGIN_DIR_ENV,
  type SessionMode,
} from "@/shared/ipc";
import { makeGate } from "../agent/gate";
import { makeModeSwitch } from "../agent/mode";
import type { AcpPeer } from "./connection";
import type { AcpUpdate } from "./events";
import { switchMode } from "./mode";
import { answerPermission, reviewAcp } from "./permission";

let root = "";
let project = "";
let outside = "";
let bundle = "";

const OPTIONS = [
  { kind: "allow_once", name: "Allow", optionId: "allow" },
  { kind: "allow_always", name: "Always allow", optionId: "always" },
  { kind: "reject_once", name: "Deny", optionId: "reject" },
];

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "remocn-acp-")));
  project = join(root, "project");
  outside = join(root, "elsewhere", "secret.txt");

  await mkdir(join(project, "src"), { recursive: true });
  await mkdir(join(root, "elsewhere"), { recursive: true });
  await writeFile(join(project, "src", "Main.tsx"), "");
  await writeFile(outside, "");
  await symlink(outside, join(project, "link.txt"));

  bundle = join(root, "bundle");
  await mkdir(join(bundle, "skills", "motion-design", "rules"), {
    recursive: true,
  });
  await writeFile(
    join(bundle, "skills", "motion-design", "rules", "foundations.md"),
    "# foundations\n"
  );
  process.env[PLUGIN_DIR_ENV] = bundle;
});

afterAll(async () => {
  delete process.env[PLUGIN_DIR_ENV];
  await rm(root, { force: true, recursive: true });
});

function harness() {
  const gate = makeGate();
  const events: AgentEvent[] = [];
  const modes: SessionMode[] = [];

  return {
    events,
    gate,
    modes,
    options: {
      cwd: project,
      permissions: gate.forTurn({
        applyMode: (mode) => Effect.sync(() => modes.push(mode)),
        emit: (event) => Effect.sync(() => events.push(event)),
        turnId: "turn-1",
      }),
    },
  };
}

function review(toolCall: AcpUpdate) {
  return Effect.runPromise(reviewAcp(project, toolCall));
}

function askedId(events: AgentEvent[]): string {
  const event = events.find((candidate) => candidate.type === "permission");
  if (event === undefined || event.type !== "permission") {
    throw new Error("no permission was raised");
  }
  return event.id;
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("reviewAcp", () => {
  it("always asks for execute, which is what Bash means here", async () => {
    expect(
      await review({ kind: "execute", title: "Run rm -rf" })
    ).toMatchObject({ reason: "bash" });
  });

  it("runs file work inside the folder without a card", async () => {
    expect(
      await review({
        kind: "read",
        locations: [{ path: join(project, "src", "Main.tsx") }],
      })
    ).toEqual({ kind: "allow" });
  });

  it("runs a file not yet created inside the folder without a card", async () => {
    expect(
      await review({
        kind: "edit",
        locations: [{ path: join(project, "src", "scenes", "Intro.tsx") }],
      })
    ).toEqual({ kind: "allow" });
  });

  it("asks about a symlink inside the folder that leads out, naming where it lands", async () => {
    const verdict = await review({
      kind: "read",
      locations: [{ path: join(project, "link.txt") }],
    });

    expect(verdict).toMatchObject({ reason: "outside" });
    expect(verdict).toHaveProperty(
      "signature",
      expect.stringContaining(outside)
    );
  });

  it("asks about a path climbing out of the folder", async () => {
    expect(
      await review({
        kind: "edit",
        locations: [{ path: join(project, "..", "elsewhere", "secret.txt") }],
      })
    ).toMatchObject({ reason: "outside" });
  });

  it("reads and searches the shipped bundle without a card, as Claude does", async () => {
    const page = join(
      bundle,
      "skills",
      "motion-design",
      "rules",
      "foundations.md"
    );

    expect(await review({ kind: "read", locations: [{ path: page }] })).toEqual(
      { kind: "allow" }
    );
    expect(
      await review({ kind: "search", locations: [{ path: bundle }] })
    ).toEqual({ kind: "allow" });
  });

  it("still asks before anything is written into the shipped bundle", async () => {
    const page = join(
      bundle,
      "skills",
      "motion-design",
      "rules",
      "foundations.md"
    );

    const verdicts = await Promise.all(
      ["edit", "delete", "move"].map((kind) =>
        review({ kind, locations: [{ path: page }] })
      )
    );

    for (const verdict of verdicts) {
      expect(verdict).toMatchObject({ reason: "outside" });
    }
  });

  it("still asks about a read outside both the folder and the bundle", async () => {
    expect(
      await review({ kind: "read", locations: [{ path: outside }] })
    ).toMatchObject({ reason: "outside" });
  });

  it("treats the bundle as any other outside path when the app shipped none", async () => {
    const page = join(
      bundle,
      "skills",
      "motion-design",
      "rules",
      "foundations.md"
    );
    delete process.env[PLUGIN_DIR_ENV];

    try {
      expect(
        await review({ kind: "read", locations: [{ path: page }] })
      ).toMatchObject({ reason: "outside" });
    } finally {
      process.env[PLUGIN_DIR_ENV] = bundle;
    }
  });

  it("asks about a kind it does not recognise, and a call with no locations", async () => {
    expect(
      await review({ kind: "other", title: "Do something" })
    ).toMatchObject({ reason: "tool" });
    expect(await review({ kind: "edit" })).toMatchObject({ reason: "tool" });
  });

  it("treats a request to switch mode as the plan", async () => {
    expect(
      await review({
        kind: "switch_mode",
        rawInput: { plan: "1. Build it" },
        title: "Ready to code?",
      })
    ).toMatchObject({ reason: "plan" });
  });
});

describe("answerPermission", () => {
  it("allows in-folder file work without raising a card", async () => {
    const { events, options } = harness();

    const answer = await answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "read",
        locations: [{ path: join(project, "src", "Main.tsx") }],
      },
    });

    expect(answer.outcome).toEqual({ optionId: "allow", outcome: "selected" });
    expect(events).toHaveLength(0);
  });

  it("raises an outside card for a symlink leading out, and declines it", async () => {
    const { events, gate, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "read",
        locations: [{ path: join(project, "link.txt") }],
        title: "Read link.txt",
      },
    });

    await settled();
    expect(events.at(0)).toMatchObject({ reason: "outside" });
    await Effect.runPromise(gate.answer(askedId(events), "deny", null));

    expect((await pending).outcome).toEqual({
      optionId: "reject",
      outcome: "selected",
    });
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

    await settled();
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
    await settled();
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

    await settled();
    await Effect.runPromise(gate.answer(askedId(events), "deny", null));

    expect((await pending).outcome).toEqual({
      optionId: "reject",
      outcome: "selected",
    });
  });

  it("raises a plan card carrying the plan the agent sent", async () => {
    const { events, gate, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "switch_mode",
        rawInput: { plan: "1. Build the title card" },
        title: "Ready to code?",
      },
    });

    await settled();
    expect(events.at(0)).toMatchObject({
      input: { plan: "1. Build the title card" },
      reason: "plan",
    });
    await Effect.runPromise(gate.answer(askedId(events), "deny", null));
    await pending;
  });

  it("falls back to the request's title when no plan was sent", async () => {
    const { events, gate, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: { kind: "switch_mode", title: "Ready to code?" },
    });

    await settled();
    expect(events.at(0)).toMatchObject({
      input: { plan: "Ready to code?" },
      reason: "plan",
    });
    await Effect.runPromise(gate.answer(askedId(events), "deny", null));
    await pending;
  });

  it("applies a plan approved into accept edits and picks allow once", async () => {
    const { events, gate, modes, options } = harness();

    const pending = answerPermission(options, {
      options: OPTIONS,
      toolCall: {
        kind: "switch_mode",
        rawInput: { plan: "1. Build it" },
        title: "Ready to code?",
      },
    });

    await settled();
    await Effect.runPromise(
      gate.answer(askedId(events), "allow", "acceptEdits")
    );

    expect((await pending).outcome).toEqual({
      optionId: "allow",
      outcome: "selected",
    });
    expect(modes).toEqual(["acceptEdits"]);
  });

  it("answers the plan card even when the agent never answers the switch", async () => {
    const gate = makeGate();
    const events: AgentEvent[] = [];
    const lines: string[] = [];
    const switcher = await Effect.runPromise(makeModeSwitch());
    const silent: AcpPeer = {
      exited: new Promise(() => undefined),
      kill: () => undefined,
      notify: () => undefined,
      request: () => new Promise(() => undefined),
    };
    const held = {
      modes: {
        availableModes: [{ id: "x#plan" }, { id: "x#agent" }],
        currentModeId: "x#plan",
      },
    };
    await Effect.runPromise(
      switcher.bind(async (mode) => {
        if (
          !(await switchMode(
            silent,
            "s1",
            mode,
            held,
            (line) => lines.push(line),
            20
          ))
        ) {
          throw new Error(`the agent did not enter ${mode}`);
        }
      })
    );

    const pending = answerPermission(
      {
        cwd: project,
        permissions: gate.forTurn({
          applyMode: (mode) => Effect.asVoid(switcher.set(mode)),
          emit: (event) => Effect.sync(() => events.push(event)),
          turnId: "turn-1",
        }),
      },
      {
        options: OPTIONS,
        toolCall: { kind: "switch_mode", title: "Ready to code?" },
      }
    );

    await settled();
    await Effect.runPromise(
      gate.answer(askedId(events), "allow", "acceptEdits")
    );

    expect((await pending).outcome).toEqual({
      optionId: "allow",
      outcome: "selected",
    });
    expect(lines).toEqual([
      "acp: could not enter acceptEdits: the agent did not answer in time",
    ]);
  });

  it("raises no card and switches no mode when the agent offers no allow-once on a plan", async () => {
    const { events, modes, options } = harness();

    const answer = await answerPermission(options, {
      options: [
        { kind: "allow_always", name: "Auto-accept", optionId: "always" },
        { kind: "reject_once", name: "Keep planning", optionId: "reject" },
      ],
      toolCall: {
        kind: "switch_mode",
        rawInput: { plan: "1. Build it" },
        title: "Ready to code?",
      },
    });

    expect(answer.outcome).toEqual({ outcome: "cancelled" });
    expect(events).toHaveLength(0);
    expect(modes).toEqual([]);
  });

  it("cancels rather than inventing an option the agent did not offer", async () => {
    const { options } = harness();

    const answer = await answerPermission(options, {
      options: [],
      toolCall: {
        kind: "read",
        locations: [{ path: join(project, "src", "Main.tsx") }],
      },
    });

    expect(answer.outcome).toEqual({ outcome: "cancelled" });
  });
});
