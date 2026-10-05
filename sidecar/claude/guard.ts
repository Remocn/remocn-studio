import type {
  CanUseTool,
  HookCallbackMatcher,
  HookJSONOutput,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { Effect, Exit } from "effect";
import type { SessionMode } from "@/shared/ipc";
import type { TurnGate } from "../agent/gate";
import { EXIT_PLAN_TOOL, review } from "./permission";

export interface GuardOptions {
  readonly cwd: string;
  readonly permissions: TurnGate;
}

const ALLOWED: PermissionResult = { behavior: "allow" };

export function permissionGuard(options: GuardOptions): CanUseTool {
  return async (toolName, input, { signal }) => {
    if (signal.aborted) {
      return denied(toolName);
    }

    const exit = await Effect.runPromiseExit(decide(options, toolName, input), {
      signal,
    });
    return Exit.isSuccess(exit) ? exit.value : denied(toolName);
  };
}

function decide(
  options: GuardOptions,
  toolName: string,
  input: Record<string, unknown>
): Effect.Effect<PermissionResult> {
  return review(options.cwd, toolName, input).pipe(
    Effect.flatMap((verdict) =>
      options.permissions.ask({ input, name: toolName, verdict })
    ),
    Effect.map((answer) =>
      answer.kind === "allow" ? ALLOWED : denied(toolName)
    )
  );
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

// Claude Code decides a call is safe *before* `canUseTool` is consulted, so in
// `acceptEdits` and `plan` — where #223's "anything outside the folder always
// asks" is absolute rather than best-effort — a Bash command it likes runs with
// the gate never seeing it. A PreToolUse hook runs for every call ahead of that
// classifier: this one answers "ask" for exactly the calls `review()` wants a
// card for, which routes them into the same `canUseTool` above. `auto` keeps no
// hook on purpose — the classifier deciding first is the trade that mode is.
const ABSOLUTE: readonly SessionMode[] = ["acceptEdits", "plan"];

const PASS: HookJSONOutput = { continue: true };

export function gateHooks(
  mode: SessionMode,
  cwd: string
): Partial<Record<"PreToolUse", HookCallbackMatcher[]>> | undefined {
  if (!ABSOLUTE.includes(mode)) {
    return;
  }

  return {
    PreToolUse: [{ hooks: [forceAsk(cwd)] }],
  };
}

function forceAsk(cwd: string) {
  return async (input: {
    readonly hook_event_name?: string;
    readonly tool_input?: unknown;
    readonly tool_name?: string;
  }): Promise<HookJSONOutput> => {
    if (
      input.hook_event_name !== "PreToolUse" ||
      input.tool_name === undefined
    ) {
      return PASS;
    }

    const exit = await Effect.runPromiseExit(
      review(cwd, input.tool_name, fields(input.tool_input))
    );

    if (!(Exit.isSuccess(exit) && exit.value.kind === "ask")) {
      return PASS;
    }

    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          "The studio decides this one: it goes to the person as an Allow/Deny card.",
      },
    };
  };
}

function fields(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}
