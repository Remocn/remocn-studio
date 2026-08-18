import { Deferred, type Duration, Effect } from "effect";
import type { PermissionDecision, SessionMode } from "@/shared/ipc";

export interface PermissionAsk {
  readonly id: string;
  readonly signature: string;
  readonly turnId: string;
}

export interface GateAnswer {
  readonly decision: PermissionDecision;
  readonly mode: SessionMode | null;
}

export interface PermissionGate {
  readonly abandon: (turnId: string) => Effect.Effect<void>;
  readonly answer: (
    id: string,
    decision: PermissionDecision,
    mode: SessionMode | null
  ) => Effect.Effect<boolean>;
  readonly remembers: (signature: string) => Effect.Effect<boolean>;
  readonly wait: (ask: PermissionAsk) => Effect.Effect<GateAnswer>;
}

interface Pending {
  readonly deferred: Deferred.Deferred<GateAnswer>;
  readonly signature: string;
  readonly turnId: string;
}

const REFUSED: GateAnswer = { decision: "deny", mode: null };

const UNANSWERED = "10 minutes";

export function makeGate(
  unanswered: Duration.Input = UNANSWERED
): PermissionGate {
  const pending = new Map<string, Pending>();
  const remembered = new Set<string>();

  const settle = (
    id: string,
    decision: PermissionDecision,
    mode: SessionMode | null
  ) =>
    Effect.suspend(() => {
      const entry = pending.get(id);
      if (entry === undefined) {
        return Effect.succeed(false);
      }

      pending.delete(id);
      if (decision === "always") {
        remembered.add(entry.signature);
      }

      return Effect.as(
        Deferred.succeed(entry.deferred, { decision, mode }),
        true
      );
    });

  return {
    abandon: (turnId) =>
      Effect.suspend(() =>
        Effect.forEach(
          [...pending]
            .filter(([, entry]) => entry.turnId === turnId)
            .map(([id]) => id),
          (id) => settle(id, "deny", null),
          { discard: true }
        )
      ),

    answer: settle,

    remembers: (signature) => Effect.sync(() => remembered.has(signature)),

    wait: (ask) =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<GateAnswer>();
        pending.set(ask.id, {
          deferred,
          signature: ask.signature,
          turnId: ask.turnId,
        });
        return yield* Deferred.await(deferred);
      }).pipe(
        Effect.timeoutOrElse({
          duration: unanswered,
          orElse: () => Effect.succeed(REFUSED),
        }),
        Effect.ensuring(Effect.sync(() => pending.delete(ask.id)))
      ),
  };
}
