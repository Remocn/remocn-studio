import { expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import { SOUND_RESULT } from "@/test/fixtures/sound-result";
import { causeMessage } from "../error-message";
import { prepareSoundUse, regenerateSoundPrompt } from "./turn-actions";

it("resolves the current library asset instead of reusing a stale card metadata", async () => {
  const current = {
    ...SOUND_RESULT.asset,
    name: "Renamed sound",
    path: "/new-library/door",
    slug: "renamed-door",
  };
  mockIPC(() => [current]);
  const action = await Effect.runPromise(prepareSoundUse(SOUND_RESULT));
  expect(action.assets[0].slug).toBe(current.slug);
  expect(action.assets[0].name).toBe(current.name);
});

it("refuses a sound deleted from the library without a turn submission", async () => {
  mockIPC(() => []);
  const exit = await Effect.runPromiseExit(prepareSoundUse(SOUND_RESULT));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    expect(causeMessage(exit.cause)).toContain("no longer in the library");
  }
});

it("preserves music intent and vocals when reusing or regenerating", async () => {
  const result = {
    ...SOUND_RESULT,
    request: {
      ...SOUND_RESULT.request,
      durationSeconds: 120,
      forceInstrumental: true,
      format: "mp3_44100_128" as const,
      kind: "music" as const,
    },
  };
  mockIPC(() => [result.asset]);
  expect((await Effect.runPromise(prepareSoundUse(result))).prompt).toContain(
    "as music"
  );
  const prompt = regenerateSoundPrompt(result);
  expect(prompt).toContain("version of the music");
  expect(prompt).toContain("Instrumental only: yes");
});

it("uses OpenRouter narration in a video and preserves its model and voice on regeneration", async () => {
  const result = {
    ...SOUND_RESULT,
    asset: {
      ...SOUND_RESULT.asset,
      source: {
        author: "OpenRouter",
        authorUrl: "",
        connectionId: "cn_or",
        connectionName: "My OpenRouter",
        durationSeconds: null,
        format: "mp3",
        id: SOUND_RESULT.operationId,
        kind: "speech" as const,
        model: "elevenlabs/eleven-v4-turbo",
        provider: "openrouter" as const,
        text: "Hello.",
        url: "https://openrouter.ai/activity",
        voice: "sarah",
      },
    },
    request: {
      connectionId: "cn_or",
      durationSeconds: null,
      format: "mp3" as const,
      kind: "speech" as const,
      model: "elevenlabs/eleven-v4-turbo" as const,
      name: "Narration",
      text: "Hello.",
      voice: "sarah",
    },
  };
  mockIPC(() => [result.asset]);
  expect((await Effect.runPromise(prepareSoundUse(result))).prompt).toContain(
    "as narration"
  );
  const prompt = regenerateSoundPrompt(result);
  expect(prompt).toContain("OpenRouter, cn_or");
  expect(prompt).toContain("elevenlabs/eleven-v4-turbo");
  expect(prompt).toContain("sarah");
});
