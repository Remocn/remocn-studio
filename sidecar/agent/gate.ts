import { Deferred, type Duration, Effect } from "effect";
import type { AgentEvent, PermissionDecision, SessionMode } from "@/shared/ipc";
import type { PermissionVerdict } from "./verdict";

export interface AskRequest {
  readonly id?: string;
  readonly input: unknown;
  readonly name: string;
  readonly verdict: PermissionVerdict;
}

export type AskAnswer =
  | { readonly always: boolean; readonly kind: "allow" }
  | { readonly kind: "deny" };

export interface TurnBinding {
  readonly applyMode: (mode: SessionMode) => Effect.Effect<void>;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly turnId: string;
}

export interface TurnGate {
  readonly abandon: Effect.Effect<void>;
  readonly ask: (request: AskRequest) => Effect.Effect<AskAnswer>;
}

export interface PermissionGate {
  readonly answer: (
    id: string,
    decision: PermissionDecision,
    mode: SessionMode | null
  ) => Effect.Effect<boolean>;
  readonly forTurn: (binding: TurnBinding) => TurnGate;
}

interface GateAnswer {
  readonly decision: PermissionDecision;
  readonly mode: SessionMode | null;
}

interface Pending {
  readonly deferred: Deferred.Deferred<GateAnswer>;
  readonly rememberable: boolean;
  readonly signature: string;
  readonly turnId: string;
}

const REFUSED: GateAnswer = { decision: "deny", mode: null };

const ALLOWED: AskAnswer = { always: false, kind: "allow" };

const DENIED: AskAnswer = { kind: "deny" };

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
      if (decision === "always" && !entry.rememberable) {
        return Effect.as(Deferred.succeed(entry.deferred, REFUSED), true);
      }
      if (decision === "always") {
        remembered.add(entry.signature);
      }

      return Effect.as(
        Deferred.succeed(entry.deferred, { decision, mode }),
        true
      );
    });

  const wait = (
    id: string,
    signature: string,
    rememberable: boolean,
    turnId: string,
    raise: Effect.Effect<void>
  ) =>
    Effect.gen(function* () {
      const deferred = yield* Deferred.make<GateAnswer>();
      pending.set(id, { deferred, rememberable, signature, turnId });
      yield* raise;
      return yield* Deferred.await(deferred);
    }).pipe(
      Effect.timeoutOrElse({
        duration: unanswered,
        orElse: () => Effect.succeed(REFUSED),
      }),
      Effect.ensuring(Effect.sync(() => pending.delete(id)))
    );

  return {
    answer: settle,

    forTurn: ({ applyMode, emit, turnId }) => ({
      abandon: Effect.suspend(() =>
        Effect.forEach(
          [...pending]
            .filter(([, entry]) => entry.turnId === turnId)
            .map(([id]) => id),
          (id) => settle(id, "deny", null),
          { discard: true }
        )
      ),

      ask: ({ id = crypto.randomUUID(), input, name, verdict }) =>
        Effect.gen(function* () {
          if (verdict.kind === "allow") {
            return ALLOWED;
          }

          const rememberable =
            verdict.reason !== "outward" && verdict.reason !== "plan";
          if (rememberable && remembered.has(verdict.signature)) {
            return ALLOWED;
          }

          const answer = yield* wait(
            id,
            verdict.signature,
            rememberable,
            turnId,
            emit({
              id,
              input,
              name,
              reason: verdict.reason,
              type: "permission",
            })
          );

          if (answer.decision === "deny") {
            return DENIED;
          }

          if (answer.mode !== null && verdict.reason === "plan") {
            yield* applyMode(answer.mode);
          }

          return {
            always: answer.decision === "always",
            kind: "allow",
          } satisfies AskAnswer;
        }),
    }),
  };
}
