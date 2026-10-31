import { Effect, Semaphore } from "effect";
import type { Asset, AssetSource } from "@/shared/library";
import {
  audioFormat,
  audioProvider,
  MUSIC_MODEL,
  SOUND_MODEL,
  type SoundOperation,
} from "@/shared/sound-effects";
import { LibraryError, listAssets, saveAsset } from "./store";

const importing = Semaphore.makeUnsafe(1);

export function importSound(
  operation: SoundOperation
): Effect.Effect<Asset, LibraryError> {
  return importing.withPermits(1)(
    Effect.gen(function* () {
      if (operation.state !== "completed" || operation.file === null) {
        return yield* Effect.fail(
          new LibraryError({
            message:
              "This sound has not completed. Check its operation instead of generating it again.",
          })
        );
      }
      const existing = (yield* listAssets()).find(
        (asset) =>
          (asset.source?.provider === "elevenlabs" ||
            asset.source?.provider === "openrouter") &&
          asset.source.id === operation.id
      );
      if (existing !== undefined) {
        return existing;
      }
      const { request } = operation;
      return yield* saveAsset({
        audiomap: null,
        dependencies: [],
        description: `Generated with ${audioProvider(operation)} using ${operation.connectionName}.\n${request.text}\n${audioFormat(operation)} · ${request.durationSeconds ?? "Automatic"} seconds`,
        duration: null,
        files: [operation.file],
        name: request.name,
        preview: null,
        role: null,
        source: yield* generatedSource(operation),
        type: "audio",
      }).pipe(
        Effect.mapError(
          () =>
            new LibraryError({
              message: `The sound was generated but could not be saved to the library. Its download is retained; check operation ${operation.id} to retry the local save without spending more credits.`,
            })
        )
      );
    })
  );
}

function generatedSource(
  operation: SoundOperation
): Effect.Effect<AssetSource, LibraryError> {
  const { request } = operation;
  const common = {
    author: operation.connectionName,
    authorUrl: "",
    connectionId: request.connectionId,
    connectionName: operation.connectionName,
    durationSeconds: request.durationSeconds,
    id: operation.id,
    text: request.text,
  };
  if (operation.provider === "openrouter") {
    if (!operation.model) {
      return Effect.fail(
        new LibraryError({
          message:
            "The OpenRouter operation is missing its model. Keep the download and check this operation.",
        })
      );
    }
    return Effect.succeed({
      ...common,
      format: "mp3",
      kind: request.kind ?? "sound",
      model: operation.model,
      provider: "openrouter",
      url: "https://openrouter.ai/activity",
      ...(request.kind === "speech" ? { voice: request.voice } : {}),
      ...(request.kind === "music"
        ? { forceInstrumental: request.forceInstrumental }
        : {}),
    });
  }
  if (request.kind === "speech") {
    return Effect.fail(
      new LibraryError({
        message: "Narration requires an OpenRouter operation.",
      })
    );
  }
  if (request.kind === "music") {
    return Effect.succeed({
      ...common,
      forceInstrumental: request.forceInstrumental,
      format: request.format,
      model: MUSIC_MODEL,
      provider: "elevenlabs",
      url: "https://elevenlabs.io/music",
    });
  }
  return Effect.succeed({
    ...common,
    format: request.format,
    model: SOUND_MODEL,
    provider: "elevenlabs",
    url: "https://elevenlabs.io/sound-effects",
  });
}
