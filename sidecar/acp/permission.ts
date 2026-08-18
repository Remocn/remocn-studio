import { isAbsolute, resolve, sep } from "node:path";
import { Effect } from "effect";
import type { AgentEvent, PermissionReason } from "@/shared/ipc";
import type { GateAnswer, PermissionGate } from "../agent/gate";
import { signatureOf } from "../claude/permission";
import type { AcpUpdate } from "./events";

// The slice of an ACP `session/request_permission` this bridge reads.
export interface AcpPermissionAsk {
  options?: readonly { kind?: string; name?: string; optionId?: string }[];
  toolCall?: AcpUpdate;
}

export interface AcpPermissionOptions {
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly turnId: string;
}

// The #223 invariant, spoken in ACP's vocabulary: file work whose every
// location resolves inside the opened folder runs without a card, execute
// always asks, and anything else — a location outside the folder, a kind the
// bridge does not recognise, a call with no locations at all — asks too.
// ACP carries no symlinks to chase: locations arrive resolved by the agent,
// so the check is plain path containment.
export function reviewAcp(
  cwd: string,
  toolCall: AcpUpdate | undefined
): { reason: PermissionReason; signature: string } | null {
  const kind = toolCall?.kind ?? "";
  const title = toolCall?.title ?? kind;

  if (kind === "execute") {
    return { reason: "bash", signature: signatureOf("execute", title) };
  }

  const paths = (toolCall?.locations ?? []).flatMap((location) =>
    typeof location.path === "string" ? [location.path] : []
  );

  if (FILE_KINDS.has(kind) && paths.length > 0) {
    const escaped = paths.find((path) => !inside(cwd, path));
    if (escaped === undefined) {
      return null;
    }
    return { reason: "outside", signature: signatureOf(kind, escaped) };
  }

  return { reason: "tool", signature: signatureOf(kind || "tool", title) };
}

const FILE_KINDS = new Set(["delete", "edit", "move", "read", "search"]);

export async function answerPermission(
  options: AcpPermissionOptions,
  ask: AcpPermissionAsk
): Promise<{
  outcome: { outcome: "selected"; optionId: string } | { outcome: "cancelled" };
}> {
  const verdict = reviewAcp(options.cwd, ask.toolCall);

  if (verdict === null) {
    const allow =
      pickOption(ask, "allow_once") ?? pickOption(ask, "allow_always");
    return allow === null
      ? { outcome: { outcome: "cancelled" } }
      : { outcome: { optionId: allow, outcome: "selected" } };
  }

  if (await Effect.runPromise(options.gate.remembers(verdict.signature))) {
    const allow =
      pickOption(ask, "allow_once") ?? pickOption(ask, "allow_always");
    return allow === null
      ? { outcome: { outcome: "cancelled" } }
      : { outcome: { optionId: allow, outcome: "selected" } };
  }

  const id = crypto.randomUUID();
  await Effect.runPromise(
    options.emit({
      id,
      input: ask.toolCall?.rawInput ?? {},
      name: ask.toolCall?.title ?? ask.toolCall?.kind ?? "tool",
      reason: verdict.reason,
      type: "permission",
    })
  );

  const answer: GateAnswer = await Effect.runPromise(
    options.gate.wait({
      id,
      signature: verdict.signature,
      turnId: options.turnId,
    })
  );

  if (answer.decision === "deny") {
    const reject =
      pickOption(ask, "reject_once") ?? pickOption(ask, "reject_always");
    return reject === null
      ? { outcome: { outcome: "cancelled" } }
      : { outcome: { optionId: reject, outcome: "selected" } };
  }

  const chosen =
    answer.decision === "always"
      ? (pickOption(ask, "allow_always") ?? pickOption(ask, "allow_once"))
      : (pickOption(ask, "allow_once") ?? pickOption(ask, "allow_always"));

  return chosen === null
    ? { outcome: { outcome: "cancelled" } }
    : { outcome: { optionId: chosen, outcome: "selected" } };
}

function pickOption(ask: AcpPermissionAsk, kind: string): string | null {
  const found = (ask.options ?? []).find((option) => option.kind === kind);
  return typeof found?.optionId === "string" ? found.optionId : null;
}

function inside(cwd: string, path: string): boolean {
  const root = resolve(cwd);
  const target = isAbsolute(path) ? resolve(path) : resolve(cwd, path);
  return (
    target === root ||
    target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
  );
}
