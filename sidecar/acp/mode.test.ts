import { describe, expect, it } from "bun:test";
import type { AcpPeer } from "./connection";
import { type ModeRecord, modeIdFor, switchMode, takeModeUpdate } from "./mode";
import type { SessionModes } from "./pool";

const MODES: SessionModes = {
  availableModes: [
    { id: "https://agentclientprotocol.com/protocol/session-modes#agent" },
    { id: "https://agentclientprotocol.com/protocol/session-modes#plan" },
    { id: "https://agentclientprotocol.com/protocol/session-modes#autopilot" },
  ],
  currentModeId: "https://agentclientprotocol.com/protocol/session-modes#plan",
};

const AGENT = "https://agentclientprotocol.com/protocol/session-modes#agent";
const PLAN = "https://agentclientprotocol.com/protocol/session-modes#plan";

const BASE = "https://agentclientprotocol.com/protocol/session-modes";

const COPILOT: SessionModes = {
  availableModes: [
    { id: `${BASE}#autopilot` },
    { id: `${BASE}#plan` },
    { id: `${BASE}#agent` },
  ],
  currentModeId: `${BASE}#plan`,
};

function peer(answer: "fails" | "hangs" | "ok" = "ok") {
  const sent: { method: string; params: unknown }[] = [];
  const agent: AcpPeer = {
    exited: new Promise(() => undefined),
    kill: () => undefined,
    notify: () => undefined,
    request: (method, params) => {
      sent.push({ method, params });
      if (answer === "fails") {
        return Promise.reject(new Error("not now"));
      }
      return answer === "hangs"
        ? new Promise(() => undefined)
        : Promise.resolve(undefined as never);
    },
  };
  return { agent, sent };
}

function record(modes: SessionModes | undefined = MODES): ModeRecord {
  return { modes };
}

describe("modeIdFor", () => {
  it("matches a mode by its fragment, whatever prefix the agent uses", () => {
    expect(modeIdFor("acceptEdits", MODES)).toBe(AGENT);
    expect(modeIdFor("auto", MODES)).toBe(AGENT);
    expect(modeIdFor("plan", MODES)).toBe(PLAN);
  });

  it("never takes a mode whose prefix merely contains the name", () => {
    expect(modeIdFor("acceptEdits", COPILOT)).toBe(`${BASE}#agent`);
    expect(modeIdFor("auto", COPILOT)).toBe(`${BASE}#agent`);
    expect(modeIdFor("plan", COPILOT)).toBe(`${BASE}#plan`);
  });

  it("reads the last path segment of an id with no fragment", () => {
    const modes: SessionModes = {
      availableModes: [
        { id: "https://agent.example/modes/autopilot" },
        { id: "https://agent.example/modes/Plan" },
        { id: "https://agent.example/modes/agent/" },
      ],
    };

    expect(modeIdFor("acceptEdits", modes)).toBe(
      "https://agent.example/modes/agent/"
    );
    expect(modeIdFor("plan", modes)).toBe("https://agent.example/modes/Plan");
  });

  it("finds nothing when no mode is named exactly that", () => {
    const modes: SessionModes = {
      availableModes: [
        { id: `${BASE}#autopilot` },
        { id: `${BASE}#planning` },
        { id: `${BASE}#agent-plan` },
      ],
    };

    expect(modeIdFor("acceptEdits", modes)).toBe(null);
    expect(modeIdFor("auto", modes)).toBe(null);
    expect(modeIdFor("plan", modes)).toBe(null);
  });

  it("finds nothing when the agent offers no matching mode", () => {
    expect(modeIdFor("plan", { availableModes: [{ id: "x#agent" }] })).toBe(
      null
    );
    expect(modeIdFor("plan", undefined)).toBe(null);
  });
});

describe("switchMode", () => {
  it("asks the agent to switch and remembers the mode it entered", async () => {
    const { agent, sent } = peer();
    const held = record();

    expect(
      await switchMode(agent, "s1", "acceptEdits", held, () => undefined)
    ).toBe(true);

    expect(sent).toEqual([
      {
        method: "session/set_mode",
        params: { modeId: AGENT, sessionId: "s1" },
      },
    ]);
    expect(held.modes?.currentModeId).toBe(AGENT);
    expect(held.modes?.availableModes).toEqual(MODES.availableModes);
  });

  it("sends nothing when the record already shows that mode", async () => {
    const { agent, sent } = peer();

    expect(
      await switchMode(agent, "s1", "plan", record(), () => undefined)
    ).toBe(true);
    expect(sent).toEqual([]);
  });

  it("logs a refused switch and leaves the record as it was", async () => {
    const { agent } = peer("fails");
    const held = record();
    const lines: string[] = [];

    expect(
      await switchMode(agent, "s1", "acceptEdits", held, (line) =>
        lines.push(line)
      )
    ).toBe(false);

    expect(held.modes?.currentModeId).toBe(PLAN);
    expect(lines).toEqual(["acp: could not enter acceptEdits: Error: not now"]);
  });

  it("gives up on a switch the agent never answers, and says so", async () => {
    const { agent } = peer("hangs");
    const held = record();
    const lines: string[] = [];

    expect(
      await switchMode(
        agent,
        "s1",
        "acceptEdits",
        held,
        (line) => lines.push(line),
        20
      )
    ).toBe(false);

    expect(held.modes?.currentModeId).toBe(PLAN);
    expect(lines).toEqual([
      "acp: could not enter acceptEdits: the agent did not answer in time",
    ]);
  });

  it("sends nothing when only a lookalike of the mode is offered", async () => {
    const { agent, sent } = peer();
    const held: ModeRecord = {
      modes: { availableModes: [{ id: `${BASE}#autopilot` }] },
    };

    expect(
      await switchMode(agent, "s1", "acceptEdits", held, () => undefined)
    ).toBe(false);
    expect(sent).toEqual([]);
  });

  it("answers false when the agent has no matching mode", async () => {
    const { agent, sent } = peer();

    expect(
      await switchMode(
        agent,
        "s1",
        "plan",
        { modes: undefined },
        () => undefined
      )
    ).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe("takeModeUpdate", () => {
  it("records a mode the agent reports it entered", () => {
    const held = record();

    takeModeUpdate(held, {
      currentModeId: AGENT,
      sessionUpdate: "current_mode_update",
    });

    expect(held.modes?.currentModeId).toBe(AGENT);
    expect(held.modes?.availableModes).toEqual(MODES.availableModes);
  });

  it("ignores every other update", () => {
    const held = record();

    takeModeUpdate(held, {
      content: { text: "hello" },
      sessionUpdate: "agent_message_chunk",
    });

    expect(held.modes).toBe(MODES);
  });

  it("makes the next switch back to the old mode go through", async () => {
    const { agent, sent } = peer();
    const held = record();

    takeModeUpdate(held, {
      currentModeId: AGENT,
      sessionUpdate: "current_mode_update",
    });
    await switchMode(agent, "s1", "plan", held, () => undefined);

    expect(sent).toHaveLength(1);
    expect(held.modes?.currentModeId).toBe(PLAN);
  });
});
