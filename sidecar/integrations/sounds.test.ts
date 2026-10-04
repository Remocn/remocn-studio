import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import type { CoreMethod, CoreResult } from "@/shared/ipc";
import type { SoundOperation } from "@/shared/sound-effects";
import { makeGate } from "../agent/gate";
import { CoreError } from "./core";
import { generateSounds, type SoundContext } from "./sounds";

const operation: SoundOperation = {
  account: "Actual account",
  connectionName: "Studio",
  cost: null,
  createdAt: 1,
  detail: null,
  file: null,
  id: "sound_test",
  providerRequestId: null,
  request: {
    connectionId: "cn_1",
    durationSeconds: 2,
    format: "mp3_44100_128",
    name: "Door",
    text: "Door closes",
  },
  state: "prepared",
};

function context(
  decision: "allow" | "deny" | "always",
  commitFails = false,
  music = false
) {
  const gate = makeGate("20 millis");
  const calls: CoreMethod[] = [];
  const cards: unknown[] = [];
  const result: SoundContext = {
    ask: (method) =>
      Effect.suspend(() => {
        calls.push(method);
        if (method === "sounds.commit" && commitFails) {
          return Effect.fail(new CoreError({ message: "The reply was lost." }));
        }
        return Effect.succeed({
          ...operation,
          request: music
            ? {
                ...operation.request,
                durationSeconds: 120,
                forceInstrumental: true,
                kind: "music",
              }
            : operation.request,
          state: method === "sounds.commit" ? "uncertain" : "prepared",
        } as CoreResult<typeof method>);
      }),
    emit: (event) => {
      if (event.type !== "permission") {
        return Effect.void;
      }
      cards.push(event.input);
      return gate.answer(event.id, decision, null).pipe(
        Effect.tap((matched) => Effect.sync(() => expect(matched).toBe(true))),
        Effect.asVoid
      );
    },
    permissions: gate.forTurn({
      applyMode: () => Effect.void,
      emit: (event) => result.emit(event),
      turnId: "turn_1",
    }),
  };
  return { calls, cards, result };
}

describe("shared paid generation service", () => {
  it("requires approval at the shared execution seam", async () => {
    const test = context("deny");
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          generateSounds([operation.request], test.result)
        )
      )
    ).toBe(true);
    expect(test.calls).toEqual(["sounds.prepare", "sounds.cancel"]);
    expect(JSON.stringify(test.cards)).toContain("Actual account");
    expect(JSON.stringify(test.cards)).toContain("spends credits");
  });
  it("never treats an always response as paid authorization", async () => {
    const test = context("always");
    await Effect.runPromiseExit(
      generateSounds([operation.request], test.result)
    );
    await Effect.runPromiseExit(
      generateSounds([operation.request], test.result)
    );
    expect(test.calls).not.toContain("sounds.commit");
    expect(test.cards).toHaveLength(2);
  });
  it.each([false, true])(
    "never repeats a commit (lost reply: %s)",
    async (fails) => {
      const test = context("allow", fails);
      await Effect.runPromiseExit(
        generateSounds([operation.request], test.result)
      );
      expect(
        test.calls.filter((method) => method === "sounds.commit")
      ).toHaveLength(1);
      expect(test.calls.at(-1)).toBe("sounds.cancel");
    }
  );
  it("aborting a pending card sends no paid request", async () => {
    const test = context("allow");
    const controller = new AbortController();
    test.result.emit = () => Effect.sync(() => controller.abort());
    await Effect.runPromiseExit(
      generateSounds([operation.request], test.result),
      {
        signal: controller.signal,
      }
    );
    expect(test.calls).not.toContain("sounds.commit");
    expect(test.calls.at(-1)).toBe("sounds.cancel");
  });
  it("a stopped wait after dispatch only cancels waiting, never dispatches twice", async () => {
    const test = context("allow");
    const controller = new AbortController();
    test.result.ask = (method) =>
      Effect.suspend(() => {
        test.calls.push(method);
        if (method === "sounds.commit") {
          controller.abort();
        }
        return Effect.succeed(operation as CoreResult<typeof method>);
      });
    await Effect.runPromiseExit(
      generateSounds([operation.request], test.result),
      {
        signal: controller.signal,
      }
    );
    expect(
      test.calls.filter((method) => method === "sounds.commit")
    ).toHaveLength(1);
    expect(test.calls.at(-1)).toBe("sounds.cancel");
  });
});

it.each(["deny", "allow"] as const)(
  "requires explicit approval for music: %s",
  async (decision) => {
    const test = context(decision, false, true);
    await Effect.runPromiseExit(
      generateSounds(
        [
          {
            ...operation.request,
            durationSeconds: 120,
            forceInstrumental: true,
            format: "mp3_44100_128",
            kind: "music",
          },
        ],
        test.result
      )
    );
    expect(
      test.calls.filter((method) => method === "sounds.commit")
    ).toHaveLength(decision === "allow" ? 1 : 0);
    expect(JSON.stringify(test.cards)).toContain("Music · Instrumental");
    expect(JSON.stringify(test.cards)).toContain("120 seconds");
  }
);

describe("several sounds in one call", () => {
  const requests = ["Door", "Rain", "Bell"].map((name) => ({
    ...operation.request,
    name,
    text: `${name} sound`,
  }));

  function batch(options: { failCommit?: string; failPrepare?: string } = {}) {
    const gate = makeGate("1 second");
    const calls: string[] = [];
    const cards: { id: string; input: unknown }[] = [];
    const allRaised = Promise.withResolvers<void>();
    let prepared = 0;
    const result: SoundContext = {
      ask: (method, params) =>
        Effect.suspend(() => {
          if (method === "sounds.prepare") {
            const request = params as (typeof requests)[number];
            if (request.name === options.failPrepare) {
              return Effect.fail(
                new CoreError({ message: "The format is not available." })
              );
            }
            prepared += 1;
            const id = `sound_${prepared}`;
            calls.push(`${method}:${id}`);
            return Effect.succeed({
              ...operation,
              id,
              request,
            } as CoreResult<typeof method>);
          }
          const { id } = params as { id: string };
          calls.push(`${method}:${id}`);
          if (method === "sounds.commit" && id === options.failCommit) {
            return Effect.fail(
              new CoreError({ message: "The reply was lost." })
            );
          }
          return Effect.succeed({
            ...operation,
            id,
            state: method === "sounds.commit" ? "uncertain" : "prepared",
          } as CoreResult<typeof method>);
        }),
      emit: (event) =>
        Effect.sync(() => {
          if (event.type === "permission") {
            cards.push({ id: event.id, input: event.input });
          }
          if (cards.length === requests.length) {
            allRaised.resolve();
          }
        }),
      permissions: gate.forTurn({
        applyMode: () => Effect.void,
        emit: (event) => result.emit(event),
        turnId: "turn_1",
      }),
    };
    return { calls, cards, gate, raised: allRaised.promise, result };
  }

  function answerAll(
    test: ReturnType<typeof batch>,
    decision: "allow" | "deny"
  ) {
    return Promise.all(
      test.cards.map((card) =>
        Effect.runPromise(test.gate.answer(card.id, decision, null))
      )
    );
  }

  function answered(exit: Exit.Exit<string, unknown>) {
    return JSON.parse(Exit.isSuccess(exit) ? exit.value : "{}") as {
      sounds: { detail?: string; name: string; state: string }[];
    };
  }

  it("raises every ask before any answer and sends only the approved sounds, in order", async () => {
    const test = batch();
    const running = Effect.runPromiseExit(
      generateSounds(requests, test.result)
    );
    await test.raised;

    expect(test.cards.map((card) => card.id)).toEqual([
      "sound_1",
      "sound_2",
      "sound_3",
    ]);
    expect(JSON.stringify(test.cards)).toContain("Rain sound");
    expect(test.calls.some((call) => call.startsWith("sounds.commit"))).toBe(
      false
    );

    await Effect.runPromise(test.gate.answer("sound_2", "deny", null));
    await Effect.runPromise(test.gate.answer("sound_1", "allow", null));
    await Effect.runPromise(test.gate.answer("sound_3", "allow", null));
    const exit = await running;

    expect(
      test.calls.filter((call) => call.startsWith("sounds.commit"))
    ).toEqual(["sounds.commit:sound_1", "sounds.commit:sound_3"]);
    expect(
      answered(exit).sounds.map((sound) => [sound.name, sound.state])
    ).toEqual([
      ["Door", "uncertain"],
      ["Rain", "declined"],
      ["Bell", "uncertain"],
    ]);
    expect(
      test.calls.filter((call) => call.startsWith("sounds.cancel"))
    ).toHaveLength(3);
  });

  it("fails with one sentence and sends nothing when every sound is declined", async () => {
    const test = batch();
    const running = Effect.runPromiseExit(
      generateSounds(requests, test.result)
    );
    await test.raised;
    await answerAll(test, "deny");
    const exit = await running;

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("declined these sound generations");
    expect(test.calls.some((call) => call.startsWith("sounds.commit"))).toBe(
      false
    );
  });

  it("raises no card and cancels what it prepared when one sound is refused", async () => {
    const test = batch({ failPrepare: "Rain" });
    const exit = await Effect.runPromiseExit(
      generateSounds(requests, test.result)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(test.cards).toHaveLength(0);
    expect(test.calls).toEqual([
      "sounds.prepare:sound_1",
      "sounds.cancel:sound_1",
    ]);
  });

  it("reports a failed sound beside the others and never retries it", async () => {
    const test = batch({ failCommit: "sound_1" });
    const running = Effect.runPromiseExit(
      generateSounds(requests, test.result)
    );
    await test.raised;
    await answerAll(test, "allow");
    const { sounds } = answered(await running);

    expect(sounds[0]).toMatchObject({
      detail: "The reply was lost.",
      name: "Door",
      state: "failed",
    });
    expect(
      test.calls.filter((call) => call.startsWith("sounds.commit"))
    ).toEqual([
      "sounds.commit:sound_1",
      "sounds.commit:sound_2",
      "sounds.commit:sound_3",
    ]);
  });

  it("refuses every waiting sound when the turn stops", async () => {
    const test = batch();
    const running = Effect.runPromiseExit(
      generateSounds(requests, test.result)
    );
    await test.raised;
    await Effect.runPromise(test.result.permissions.abandon);

    expect(Exit.isFailure(await running)).toBe(true);
    expect(test.calls.some((call) => call.startsWith("sounds.commit"))).toBe(
      false
    );
  });
});
