import { afterEach, beforeEach, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import type { AgentEvent, CoreResult } from "@/shared/ipc";
import { LIBRARY_DIR_ENV } from "@/shared/ipc";
import { promptAssetOf } from "@/shared/library";
import type { SoundOperation } from "@/shared/sound-effects";
import { type SoundContext, soundStatus } from "../integrations/sounds";
import { placeAssets } from "./insert";
import { importSound } from "./sounds";
import { listAssets } from "./store";

let root = "";
let savedEnv: string | undefined;
let operation: SoundOperation;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sound-import-"));
  savedEnv = process.env[LIBRARY_DIR_ENV];
  process.env[LIBRARY_DIR_ENV] = join(root, "library");
  const file = join(root, "sound_1.mp3");
  writeFileSync(file, "audio fixture");
  operation = {
    account: null,
    connectionName: "Mine",
    cost: "10",
    createdAt: 1,
    detail: null,
    file,
    id: "sound_1",
    providerRequestId: "req_1",
    request: {
      connectionId: "cn_1",
      durationSeconds: 2,
      format: "mp3_44100_128",
      name: "Door",
      text: "Wooden door",
    },
    state: "completed",
  };
});
afterEach(() => {
  process.env[LIBRARY_DIR_ENV] = savedEnv;
  rmSync(root, { force: true, recursive: true });
});

it("imports concurrently exactly once and keeps generation provenance", async () => {
  const [one, two] = await Promise.all([
    Effect.runPromise(importSound(operation)),
    Effect.runPromise(importSound(operation)),
  ]);
  expect(one.slug).toBe(two.slug);
  expect(await Effect.runPromise(listAssets())).toHaveLength(1);
  expect(one.source).toMatchObject({
    connectionId: "cn_1",
    id: operation.id,
    model: "eleven_text_to_sound_v2",
    provider: "elevenlabs",
    text: operation.request.text,
  });
  const manifest = readFileSync(join(one.path, "manifest.json"), "utf8");
  expect(manifest).not.toContain("xi-api-key");
  expect(manifest).not.toContain("secret");
});

it("preserves a previous asset with the same name", async () => {
  const one = await Effect.runPromise(importSound(operation));
  const file = join(root, "sound_2.mp3");
  writeFileSync(file, "second sound");
  const two = await Effect.runPromise(
    importSound({ ...operation, file, id: "sound_2" })
  );
  expect(one.slug).not.toBe(two.slug);
  expect(readFileSync(join(one.path, "sound_1.mp3"), "utf8")).toBe(
    "audio fixture"
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ dependencies: { remotion: "4.0.0" }, name: "test" })
  );
  await Effect.runPromise(
    placeAssets(root, [promptAssetOf(one), promptAssetOf(two)])
  );
  expect(readFileSync(join(root, "public/library/sound_1.mp3"), "utf8")).toBe(
    "audio fixture"
  );
  expect(readFileSync(join(root, "public/library/sound_2.mp3"), "utf8")).toBe(
    "second sound"
  );
});

it("recovers a failed local copy from the same completed operation", async () => {
  const file = operation.file as string;
  rmSync(file);
  expect(
    Exit.isFailure(await Effect.runPromiseExit(importSound(operation)))
  ).toBe(true);
  writeFileSync(file, "recovered audio");
  const saved = await Effect.runPromise(importSound(operation));
  expect(readFileSync(join(saved.path, "sound_1.mp3"), "utf8")).toBe(
    "recovered audio"
  );
  expect(await Effect.runPromise(listAssets())).toHaveLength(1);
});

it("inserts into a project only on request and preserves its edits", async () => {
  const asset = await Effect.runPromise(importSound(operation));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ dependencies: { remotion: "4.0.0" }, name: "test" })
  );
  const placed = await Effect.runPromise(
    placeAssets(root, [promptAssetOf(asset)])
  );
  expect(placed).toHaveLength(1);
  const target = join(root, "public", "library", "sound_1.mp3");
  writeFileSync(target, "user edit");
  await Effect.runPromise(placeAssets(root, [promptAssetOf(asset)]));
  expect(readFileSync(target, "utf8")).toBe("user edit");
});

it("publishes a saved sound card from a completed or already imported operation", async () => {
  const events: AgentEvent[] = [];
  const emit: SoundContext["emit"] = (event) =>
    Effect.sync(() => {
      events.push(event);
    });
  const ask: SoundContext["ask"] = (method) =>
    Effect.succeed(operation as CoreResult<typeof method>);
  await Effect.runPromise(soundStatus(ask, operation.id, emit));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    result: {
      asset: { type: "audio" },
      operationId: operation.id,
      request: operation.request,
    },
    type: "sound_result",
  });
  expect(JSON.stringify(events)).not.toContain(operation.file as string);
  operation = { ...operation, file: null, state: "imported" };
  await Effect.runPromise(soundStatus(ask, operation.id, emit));
  expect(events).toHaveLength(2);
});

it("saves and recovers music with its model and vocal preference", async () => {
  const music: SoundOperation = {
    ...operation,
    request: {
      ...operation.request,
      durationSeconds: 120,
      forceInstrumental: true,
      format: "mp3_44100_128",
      kind: "music",
    },
  };
  const one = await Effect.runPromise(importSound(music));
  const two = await Effect.runPromise(importSound(music));
  expect(one.slug).toBe(two.slug);
  const assets = await Effect.runPromise(listAssets());
  expect(assets).toHaveLength(1);
  expect(assets[0].source).toMatchObject({
    durationSeconds: 120,
    forceInstrumental: true,
    model: "music_v1",
  });
});

it("imports and recovers OpenRouter narration with its model and voice", async () => {
  const narration: SoundOperation = {
    ...operation,
    model: "elevenlabs/eleven-v4",
    provider: "openrouter",
    request: {
      connectionId: "cn_openrouter",
      durationSeconds: null,
      format: "mp3",
      kind: "speech",
      model: "elevenlabs/eleven-v4",
      name: "Narration",
      text: "Welcome to the film.",
      voice: "george",
    },
  };
  const saved = await Effect.runPromise(importSound(narration));
  expect(saved.source).toMatchObject({
    kind: "speech",
    model: "elevenlabs/eleven-v4",
    provider: "openrouter",
    voice: "george",
  });
  expect(saved.description).toContain("OpenRouter");
  const recovered = await Effect.runPromise(importSound(narration));
  expect(recovered.slug).toBe(saved.slug);
  expect(await Effect.runPromise(listAssets())).toHaveLength(1);
});
