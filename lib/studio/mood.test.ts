import { describe, expect, it } from "vitest";
import { shellMood } from "@/lib/studio/mood";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";

function turns(...states: TurnState[]): ReadonlyMap<string, TurnState> {
  return new Map(states.map((state, index) => [`session-${index}`, state]));
}

const RUNNING: TurnState = { ...IDLE_TURN, isRunning: true };
const FAILED: TurnState = { ...IDLE_TURN, error: "it broke" };
const WAITING: TurnState = {
  ...IDLE_TURN,
  permissions: [
    {
      askedAt: 0,
      id: "ask-1",
      input: {},
      name: "Bash",
      reason: "bash",
    },
  ],
};

describe("shellMood", () => {
  it("is idle and still when nothing has run", () => {
    expect(shellMood(turns())).toEqual({ isBusy: false, tone: "idle" });
    expect(shellMood(turns(IDLE_TURN))).toEqual({
      isBusy: false,
      tone: "idle",
    });
  });

  it("reads a running turn as motion, not as a colour", () => {
    expect(shellMood(turns(RUNNING))).toEqual({ isBusy: true, tone: "idle" });
  });

  it("takes the tone from any session, wherever it is in the map", () => {
    expect(shellMood(turns(IDLE_TURN, FAILED)).tone).toBe("failed");
    expect(shellMood(turns(WAITING, IDLE_TURN)).tone).toBe("waiting");
  });

  // A question you can answer outranks a failure you cannot: the failure has
  // already happened, the question is still holding a turn open.
  it("lets a waiting session outrank a failed one, in either order", () => {
    expect(shellMood(turns(FAILED, WAITING)).tone).toBe("waiting");
    expect(shellMood(turns(WAITING, FAILED)).tone).toBe("waiting");
  });

  it("reports motion alongside a tone", () => {
    expect(shellMood(turns(RUNNING, WAITING))).toEqual({
      isBusy: true,
      tone: "waiting",
    });
  });
});
