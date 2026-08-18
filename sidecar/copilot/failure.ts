import type { AgentFailure, AgentFailureKind } from "@/shared/ipc";

export const NOT_AUTHENTICATED =
  "Copilot is not signed in. Run `copilot login` in a terminal, sign in with your GitHub account, then try again.";

export const POLICY_BLOCKED =
  "This GitHub account is not allowed to use the Copilot CLI — an organization or enterprise policy has to enable it. Ask your organization's admin, or sign in with an account whose plan includes the CLI.";

const UNKNOWN = "Copilot stopped without saying why.";

// Copilot reports both of its login failures as ordinary message text, not
// as errors — measured against copilot 1.0.80, where a policy-blocked
// account gets a normal turn whose whole answer is the first marker below.
const POLICY_MARKER = "not authorized to use this copilot feature";

const AUTH_MARKERS = ["copilot login", "not logged in", "unauthorized", "401"];

const USAGE_MARKERS = ["credit", "quota", "rate limit", "429"];

export function failureFromText(text: string): AgentFailure {
  const kind = kindOfText(text);
  return { kind, message: readable(text, kind) };
}

// The in-band variant: a turn whose *message* opens with a login failure.
// Only the two exact shapes the CLI is known to speak are matched, because
// pattern-matching model prose any wider would eat real answers.
export function inBandFailure(firstChunk: string): AgentFailure | null {
  const haystack = firstChunk.trim().toLowerCase();

  if (!haystack.startsWith("error:")) {
    return null;
  }

  if (haystack.includes(POLICY_MARKER)) {
    return { kind: "auth", message: POLICY_BLOCKED };
  }
  if (
    haystack.includes("not logged in") ||
    haystack.includes("copilot login")
  ) {
    return { kind: "auth", message: NOT_AUTHENTICATED };
  }

  return null;
}

function kindOfText(text: string): AgentFailureKind {
  const haystack = text.toLowerCase();

  if (USAGE_MARKERS.some((marker) => haystack.includes(marker))) {
    return "usage";
  }
  if (haystack.includes(POLICY_MARKER)) {
    return "auth";
  }
  if (AUTH_MARKERS.some((marker) => haystack.includes(marker))) {
    return "auth";
  }
  return "unknown";
}

function readable(text: string, kind: AgentFailureKind): string {
  if (kind === "auth") {
    return text.toLowerCase().includes(POLICY_MARKER)
      ? POLICY_BLOCKED
      : NOT_AUTHENTICATED;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN;
}
