import type {
  CanUseTool,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { Deferred, type Duration, Effect, Exit } from "effect";
import type {
  ClaudeEvent,
  PermissionDecision,
  SessionMode,
} from "@/shared/ipc";
import { EXIT_PLAN_TOOL, review } from "./permission";

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

export interface GuardOptions {
  readonly cwd: string;
  readonly emit: (event: ClaudeEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly onApprove: (mode: SessionMode) => Effect.Effect<void>;
  readonly turnId: string;
}

interface Pending {
  readonly deferred: Deferred.Deferred<GateAnswer>;
  readonly signature: string;
  readonly turnId: string;
}

const ALLOWED: PermissionResult = { behavior: "allow" };

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

export function permissionGuard(options: GuardOptions): CanUseTool {
  return async (toolName, input, { signal }) => {
    if (signal.aborted) {
      return denied(toolName);
    }

    const id = crypto.randomUUID();
    const abort = () => {
      Effect.runFork(options.gate.answer(id, "deny", null));
    };

    signal.addEventListener("abort", abort, { once: true });

    try {
      const exit = await Effect.runPromiseExit(
        decide(options, id, toolName, input)
      );
      return Exit.isSuccess(exit) ? exit.value : denied(toolName);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  };
}

function decide(
  options: GuardOptions,
  id: string,
  toolName: string,
  input: Record<string, unknown>
): Effect.Effect<PermissionResult> {
  return Effect.gen(function* () {
    const verdict = yield* review(options.cwd, toolName, input);
    if (verdict.kind === "allow") {
      return ALLOWED;
    }

    if (yield* options.gate.remembers(verdict.signature)) {
      return ALLOWED;
    }

    yield* options.emit({
      id,
      input,
      name: toolName,
      reason: verdict.reason,
      type: "permission",
    });

    const answer = yield* options.gate.wait({
      id,
      signature: verdict.signature,
      turnId: options.turnId,
    });

    if (answer.decision === "deny") {
      return denied(toolName);
    }

    if (answer.mode !== null) {
      yield* options.onApprove(answer.mode);
    }

    return ALLOWED;
  });
}

function denied(toolName: string): PermissionResult {
  if (toolName === EXIT_PLAN_TOOL) {
    return {
      behavior: "deny",
      message:
        "The user is not ready to build this plan. Stay in plan mode, ask what they want changed, and present a revised plan.",
    };
  }

  return {
    behavior: "deny",
    message: `The user denied this ${toolName} call. Do not run it again. Carry on with what you can do without it, and say what you would have needed.`,
  };
}
