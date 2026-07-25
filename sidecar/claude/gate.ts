import type {
  CanUseTool,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { Deferred, Effect, Exit } from "effect";
import type { ClaudeEvent, PermissionDecision } from "@/shared/ipc";
import { review } from "./permission";

export interface PermissionAsk {
  readonly id: string;
  readonly signature: string;
  readonly turnId: string;
}

export interface PermissionGate {
  readonly abandon: (turnId: string) => Effect.Effect<void>;
  readonly answer: (
    id: string,
    decision: PermissionDecision
  ) => Effect.Effect<boolean>;
  readonly remembers: (signature: string) => Effect.Effect<boolean>;
  readonly wait: (ask: PermissionAsk) => Effect.Effect<PermissionDecision>;
}

export interface GuardOptions {
  readonly cwd: string;
  readonly emit: (event: ClaudeEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly turnId: string;
}

interface Pending {
  readonly deferred: Deferred.Deferred<PermissionDecision>;
  readonly signature: string;
  readonly turnId: string;
}

const ALLOWED: PermissionResult = { behavior: "allow" };

export function makeGate(): PermissionGate {
  const pending = new Map<string, Pending>();
  const remembered = new Set<string>();

  const settle = (id: string, decision: PermissionDecision) =>
    Effect.suspend(() => {
      const entry = pending.get(id);
      if (entry === undefined) {
        return Effect.succeed(false);
      }

      pending.delete(id);
      if (decision === "always") {
        remembered.add(entry.signature);
      }

      return Effect.as(Deferred.succeed(entry.deferred, decision), true);
    });

  return {
    abandon: (turnId) =>
      Effect.suspend(() =>
        Effect.forEach(
          [...pending]
            .filter(([, entry]) => entry.turnId === turnId)
            .map(([id]) => id),
          (id) => settle(id, "deny"),
          { discard: true }
        )
      ),

    answer: settle,

    remembers: (signature) => Effect.sync(() => remembered.has(signature)),

    wait: (ask) =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<PermissionDecision>();
        pending.set(ask.id, {
          deferred,
          signature: ask.signature,
          turnId: ask.turnId,
        });
        return yield* Deferred.await(deferred);
      }).pipe(
        Effect.onInterrupt(() => Effect.sync(() => pending.delete(ask.id)))
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
      Effect.runFork(options.gate.answer(id, "deny"));
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

    const decision = yield* options.gate.wait({
      id,
      signature: verdict.signature,
      turnId: options.turnId,
    });

    return decision === "deny" ? denied(toolName) : ALLOWED;
  });
}

function denied(toolName: string): PermissionResult {
  return {
    behavior: "deny",
    message: `The user denied this ${toolName} call. Do not run it again. Carry on with what you can do without it, and say what you would have needed.`,
  };
}
