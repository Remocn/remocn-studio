import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { EnvironmentCheck } from "@/shared/ipc";
import { makeAccountCache } from "./account";

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

function row(detail: string): EnvironmentCheck {
  return {
    detail,
    fix: null,
    id: "claude",
    state: "ok",
    title: "Claude Code is logged in",
  };
}

describe("makeAccountCache", () => {
  it("probes once per provider and serves the cached row after", async () => {
    let asked = 0;
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.succeed(row(`probe ${asked}`));
      })
    );

    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 1")
    );
    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 1")
    );
    expect(asked).toBe(1);
  });

  it("probes again after a clear, which is what Recheck means", async () => {
    let asked = 0;
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.succeed(row(`probe ${asked}`));
      })
    );

    await run(cache.row("claude", "/videos/promo"));
    await run(cache.clear);

    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 2")
    );
    expect(asked).toBe(2);
  });
});
