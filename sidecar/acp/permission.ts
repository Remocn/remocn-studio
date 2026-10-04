import { Effect, Exit } from "effect";
import type { PermissionReason } from "@/shared/ipc";
import type { AskAnswer, TurnGate } from "../agent/gate";
import { type PermissionVerdict, signatureOf } from "../agent/verdict";
import { escapee } from "../contained";
import { type AcpUpdate, toolText } from "./events";

// The slice of an ACP `session/request_permission` this bridge reads.
export interface AcpPermissionAsk {
  options?: readonly { kind?: string; name?: string; optionId?: string }[];
  toolCall?: AcpUpdate;
}

export interface AcpPermissionOptions {
  readonly cwd: string;
  readonly permissions: TurnGate;
}

interface AcpOutcome {
  outcome: { outcome: "selected"; optionId: string } | { outcome: "cancelled" };
}

// The #223 invariant, spoken in ACP's vocabulary: file work whose every
// location resolves inside the opened folder runs without a card, execute
// always asks, and anything else — a location outside the folder, a kind the
// bridge does not recognise, a call with no locations at all — asks too.
export function reviewAcp(
  cwd: string,
  toolCall: AcpUpdate | undefined
): Effect.Effect<PermissionVerdict> {
  const kind = toolCall?.kind ?? "";
  const title = toolCall?.title ?? kind;

  if (kind === "execute") {
    return Effect.succeed(ask("bash", "execute", title));
  }

  if (kind === SWITCH_MODE) {
    return Effect.succeed(ask("plan", SWITCH_MODE, planOf(toolCall)));
  }

  const paths = (toolCall?.locations ?? []).flatMap((location) =>
    typeof location.path === "string" ? [location.path] : []
  );

  if (FILE_KINDS.has(kind) && paths.length > 0) {
    return Effect.promise(() => escapee(cwd, [], paths)).pipe(
      Effect.map((escaped) =>
        escaped === null ? ALLOW : ask("outside", kind, escaped)
      )
    );
  }

  return Effect.succeed(ask("tool", kind || "tool", title));
}

const FILE_KINDS = new Set(["delete", "edit", "move", "read", "search"]);

const SWITCH_MODE = "switch_mode";

const ALLOW: PermissionVerdict = { kind: "allow" };

const CANCELLED: AcpOutcome = { outcome: { outcome: "cancelled" } };

export async function answerPermission(
  options: AcpPermissionOptions,
  request: AcpPermissionAsk
): Promise<AcpOutcome> {
  const { toolCall } = request;
  const exit = await Effect.runPromiseExit(
    reviewAcp(options.cwd, toolCall).pipe(
      Effect.flatMap((verdict) =>
        allowOption(request, verdict, false) === null
          ? Effect.succeed(null)
          : options.permissions
              .ask({
                input:
                  toolCall?.kind === SWITCH_MODE
                    ? { plan: planOf(toolCall) }
                    : (toolCall?.rawInput ?? {}),
                name: toolCall?.title ?? toolCall?.kind ?? "tool",
                verdict,
              })
              .pipe(Effect.map((answer) => chosen(request, verdict, answer)))
      )
    )
  );

  if (Exit.isFailure(exit) || exit.value === null) {
    return CANCELLED;
  }

  return { outcome: { optionId: exit.value, outcome: "selected" } };
}

function chosen(
  request: AcpPermissionAsk,
  verdict: PermissionVerdict,
  answer: AskAnswer
): string | null {
  if (answer.kind === "deny") {
    return (
      pickOption(request, "reject_once") ?? pickOption(request, "reject_always")
    );
  }

  return allowOption(request, verdict, answer.always);
}

function allowOption(
  request: AcpPermissionAsk,
  verdict: PermissionVerdict,
  always: boolean
): string | null {
  if (verdict.kind === "ask" && verdict.reason === "plan") {
    return pickOption(request, "allow_once");
  }

  return always
    ? (pickOption(request, "allow_always") ?? pickOption(request, "allow_once"))
    : (pickOption(request, "allow_once") ??
        pickOption(request, "allow_always"));
}

function pickOption(request: AcpPermissionAsk, kind: string): string | null {
  const found = (request.options ?? []).find((option) => option.kind === kind);
  return typeof found?.optionId === "string" ? found.optionId : null;
}

function planOf(toolCall: AcpUpdate | undefined): string {
  const raw = toolCall?.rawInput as { plan?: unknown } | undefined;
  if (typeof raw?.plan === "string" && raw.plan.length > 0) {
    return raw.plan;
  }

  const content = toolText(toolCall?.content);
  return content.length > 0 ? content : (toolCall?.title ?? "");
}

function ask(
  reason: PermissionReason,
  kind: string,
  detail: string
): PermissionVerdict {
  return { kind: "ask", reason, signature: signatureOf(kind, detail) };
}
