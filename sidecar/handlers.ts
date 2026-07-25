import { Clock, Effect, Ref, Stream } from "effect";
import {
  type ClaudeFailure,
  type ContextUsage,
  SIDECAR_PROTOCOL,
} from "@/shared/ipc";
import { eventsOf } from "./claude/events";
import { failureFromText, failureOf } from "./claude/failure";
import { makeGate, permissionGuard } from "./claude/gate";
import { messages } from "./claude/session";
import { recording } from "./history/recorder";
import { type HistoryError, HistoryStore } from "./history/store";
import { HandlerError, type Handlers } from "./host";
import { previewEvents } from "./preview/supervisor";

const TOKENS = [
  "Streaming",
  "straight",
  "out",
  "of",
  "the",
  "bun",
  "sidecar",
  "—",
  "one",
  "frame",
  "at",
  "a",
  "time.",
];

const MAX_COUNT = 500;
const MAX_DELAY_MS = 2000;

const gate = makeGate();

const unstored = (error: HistoryError) =>
  new HandlerError({ message: error.message });

export const handlers: Handlers<HistoryStore> = {
  "claude.permission": ({ params }) =>
    Effect.map(gate.answer(params.id, params.decision), (matched) => ({
      matched,
    })),

  "claude.prompt": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const turnId = yield* Effect.sync(() => crypto.randomUUID());
      const sessionId = yield* Ref.make(params.sessionId);
      const failure = yield* Ref.make<ClaudeFailure | null>(null);
      const context = yield* Ref.make<ContextUsage | null>(null);

      const store = yield* HistoryStore;
      const recorder = yield* recording(store, params, log);
      if (recorder.session !== null) {
        yield* emit({ session: recorder.session, type: "history" });
      }

      yield* Stream.runForEach(
        messages(params, {
          canUseTool: permissionGuard({ cwd: params.cwd, emit, gate, turnId }),
          log: (line) => Effect.runSync(log(line)),
          onContext: (usage) => Effect.runSync(Ref.set(context, usage)),
          onStop: () => Effect.runSync(gate.abandon(turnId)),
        }),
        (message) =>
          Effect.gen(function* () {
            if (message.type === "system" && message.subtype === "init") {
              yield* Ref.set(sessionId, message.session_id);
            }

            const found = failureOf(message);
            if (found !== null) {
              yield* Ref.set(failure, found);
            }

            yield* Effect.forEach(
              eventsOf(message),
              (event) => Effect.andThen(emit(event), recorder.event(event)),
              { discard: true }
            );
          })
      ).pipe(
        Effect.catch((error) =>
          Ref.update(
            failure,
            (current) => current ?? failureFromText(error.message)
          )
        ),
        Effect.onExit(() => gate.abandon(turnId))
      );

      return {
        context: yield* Ref.get(context),
        failure: yield* Ref.get(failure),
        sessionId: yield* Ref.get(sessionId),
      };
    }),

  "history.blocks": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.blocks(params.sessionId)
    ).pipe(Effect.mapError(unstored)),

  "history.remove": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.remove(params.sessionId)
    ).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "history.sessions": () =>
    Effect.flatMap(HistoryStore, (store) => store.sessions).pipe(
      Effect.mapError(unstored)
    ),

  "preview.start": ({ emit, log, params }) =>
    Stream.runForEach(previewEvents(params.folder, log), emit).pipe(
      Effect.as({ reason: "the preview host stopped" }),
      Effect.mapError((error) => new HandlerError({ message: error.message }))
    ),

  "sidecar.emit": ({ emit, params }) =>
    Effect.gen(function* () {
      const total = clamp(params.count, 1, MAX_COUNT);
      const delayMs = clamp(params.delayMs, 0, MAX_DELAY_MS);
      const startedAt = yield* Clock.currentTimeMillis;

      yield* Effect.forEach(
        Array.from({ length: total }, (_unused, index) => index),
        (index) =>
          Effect.sleep(delayMs).pipe(
            Effect.andThen(
              emit({ index, token: TOKENS[index % TOKENS.length], total })
            )
          ),
        { discard: true }
      );

      const finishedAt = yield* Clock.currentTimeMillis;

      return { elapsedMs: finishedAt - startedAt, emitted: total };
    }),

  "sidecar.info": () =>
    Effect.sync(() => ({
      bun: (process.versions as Record<string, string | undefined>).bun ?? "",
      cwd: process.cwd(),
      pid: process.pid,
      protocol: SIDECAR_PROTOCOL,
      uptimeMs: Math.round(process.uptime() * 1000),
    })),
};

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(Math.trunc(value), low), high);
}
