import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { SessionMode } from "@/shared/ipc";
import { makeModeSwitch } from "@/sidecar/agent/mode";

describe("makeModeSwitch", () => {
  it("passes the mode to the session it was bound to", async () => {
    const applied: SessionMode[] = [];
    const switcher = await Effect.runPromise(makeModeSwitch());

    await Effect.runPromise(
      switcher.bind((mode) => {
        applied.push(mode);
        return Promise.resolve();
      })
    );

    expect(await Effect.runPromise(switcher.set("acceptEdits"))).toBe(true);
    expect(applied).toEqual(["acceptEdits"]);
  });

  it("says nothing happened when no session is open yet", async () => {
    const switcher = await Effect.runPromise(makeModeSwitch());

    expect(await Effect.runPromise(switcher.set("auto"))).toBe(false);
  });

  it("survives a session that refuses the switch", async () => {
    const switcher = await Effect.runPromise(makeModeSwitch());

    await Effect.runPromise(
      switcher.bind(() => Promise.reject(new Error("the turn is over")))
    );

    expect(await Effect.runPromise(switcher.set("plan"))).toBe(false);
  });
});
