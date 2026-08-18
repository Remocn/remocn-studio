import type {
  CanUseTool,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { Effect, Exit } from "effect";
import type { AgentEvent, SessionMode } from "@/shared/ipc";
import type { PermissionGate } from "../agent/gate";
import { EXIT_PLAN_TOOL, review } from "./permission";

export interface GuardOptions {
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly onApprove: (mode: SessionMode) => Effect.Effect<void>;
  readonly turnId: string;
}

const ALLOWED: PermissionResult = { behavior: "allow" };

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
