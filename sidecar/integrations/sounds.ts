import { Effect } from "effect";
import type { AgentEvent } from "@/shared/ipc";
import type { Asset } from "@/shared/library";
import {
  type AudioRequest,
  type SoundOperation,
  soundSummary,
} from "@/shared/sound-effects";
import type { TurnGate } from "../agent/gate";
import type { HandlerInput } from "../host";
import { importSound } from "../library/sounds";
import { type LibraryError, listAssets } from "../library/store";
import { CoreError } from "./core";

export interface SoundContext {
  ask: HandlerInput<"agent.prompt">["ask"];
  emit: (event: AgentEvent) => Effect.Effect<void>;
  permissions: TurnGate;
}

interface SoundAnswer {
  readonly operationId: string;
  readonly state: string;
  readonly [field: string]: unknown;
}

export function soundStatus(
  ask: SoundContext["ask"],
  id: string,
  emit: SoundContext["emit"] = () => Effect.void
) {
  return ask("sounds.status", { id }).pipe(
    Effect.flatMap((operation) => describeResult(ask, operation, emit)),
    Effect.map((result) => JSON.stringify(result))
  );
}

function describeResult(
  ask: SoundContext["ask"],
  operation: SoundOperation,
  emit: SoundContext["emit"]
): Effect.Effect<SoundAnswer, CoreError | LibraryError> {
  const publish = (asset: Asset) =>
    emit({
      result: {
        asset,
        operationId: operation.id,
        request: operation.request,
      },
      type: "sound_result",
    });
  if (operation.state === "imported") {
    return listAssets().pipe(
      Effect.flatMap((assets) => {
        const asset =
          assets.find(
            (item) =>
              item.source?.provider === "elevenlabs" &&
              item.source.id === operation.id
          ) ?? null;
        return (asset === null ? Effect.void : publish(asset)).pipe(
          Effect.as({
            asset,
            message:
              "This sound was saved previously. If it was deleted from the library, recovery will not recreate it.",
            operationId: operation.id,
            state: operation.state,
          })
        );
      })
    );
  }
  if (operation.state === "completed") {
    return importSound(operation).pipe(
      Effect.tap(publish),
      Effect.tap(() => ask("sounds.imported", { id: operation.id })),
      Effect.map((asset) => ({
        asset: { name: asset.name, path: asset.path, slug: asset.slug },
        message:
          "Saved to the library. The person can listen locally and explicitly attach this asset to a Project or Video. Do not change project files unless requested.",
        operationId: operation.id,
        state: operation.state,
      }))
    );
  }
  return Effect.succeed({
    detail: operation.detail,
    operationId: operation.id,
    state: operation.state,
  });
}

const DECLINED =
  "The person declined this sound generation. Nothing was sent; do not repeat the request.";

function approval(operation: SoundOperation, context: SoundContext) {
  const { id, request } = operation;
  return context.permissions.ask({
    id,
    input: { description: soundSummary(operation) },
    name: request.kind === "music" ? "Generate music" : "Generate sound effect",
    verdict: { kind: "ask", reason: "outward", signature: `sound:${id}` },
  });
}

function dispatch(
  operation: SoundOperation,
  context: SoundContext
): Effect.Effect<SoundAnswer, CoreError | LibraryError> {
  return Effect.gen(function* () {
    const { id, request } = operation;
    yield* context.emit({
      message: `Generating ${request.kind === "music" ? "music" : "sound"} with ElevenLabs. Operation: ${id}. If waiting stops, check this operation; do not generate again automatically.`,
      type: "notice",
    });
    let current = yield* context.ask("sounds.commit", { id });
    while (current.state === "generating") {
      yield* Effect.sleep("1 second");
      current = yield* context.ask("sounds.status", { id });
    }
    return yield* describeResult(context.ask, current, context.emit);
  });
}

function outcome(
  operation: SoundOperation,
  allowed: boolean,
  context: SoundContext
): Effect.Effect<SoundAnswer> {
  const { id, request } = operation;
  if (!allowed) {
    return Effect.succeed({
      message:
        "The person declined this sound. Nothing was sent; do not request it again.",
      name: request.name,
      operationId: id,
      state: "declined",
    });
  }
  return dispatch(operation, context).pipe(
    Effect.map((result) => ({ name: request.name, ...result })),
    Effect.catch((failure) =>
      Effect.succeed({
        detail: failure.message,
        name: request.name,
        operationId: id,
        state: "failed",
      })
    )
  );
}

export function generateSounds(
  requests: readonly AudioRequest[],
  context: SoundContext
) {
  return Effect.gen(function* () {
    const prepared: SoundOperation[] = [];
    return yield* Effect.gen(function* () {
      for (const request of requests) {
        prepared.push(yield* context.ask("sounds.prepare", request));
      }
      const answers = yield* Effect.forEach(
        prepared,
        (operation) => approval(operation, context),
        { concurrency: "unbounded" }
      );
      const allowed = answers.map((answer) => answer.kind === "allow");
      if (!allowed.some(Boolean)) {
        return yield* Effect.fail(
          new CoreError({
            message:
              prepared.length === 1
                ? DECLINED
                : "The person declined these sound generations. Nothing was sent; do not repeat the request.",
          })
        );
      }
      const [only] = prepared;
      if (prepared.length === 1 && only !== undefined) {
        return JSON.stringify(yield* dispatch(only, context));
      }
      const results = yield* Effect.forEach(prepared, (operation, index) =>
        outcome(operation, allowed[index], context)
      );
      return JSON.stringify({ sounds: results });
    }).pipe(
      Effect.ensuring(
        Effect.forEach(
          prepared,
          ({ id }) => context.ask("sounds.cancel", { id }).pipe(Effect.ignore),
          { discard: true }
        )
      )
    );
  });
}

export function recoverSounds(
  ask: SoundContext["ask"],
  notice: (message: string) => Effect.Effect<void>
) {
  return ask("sounds.recover", null).pipe(
    Effect.flatMap((operations) =>
      Effect.forEach(
        operations.filter((operation) => operation.state === "completed"),
        (operation) =>
          importSound(operation).pipe(
            Effect.tap(() => ask("sounds.imported", { id: operation.id })),
            Effect.catch((failure) => notice(failure.message))
          ),
        { discard: true }
      )
    ),
    Effect.catch((failure) => notice(failure.message))
  );
}
