import type { AgentFailure, AgentFailureKind } from "@/shared/ipc";

export const NOT_AUTHENTICATED =
  "Grok is not signed in. Run `grok login` in a terminal, sign in with your SuperGrok or X Premium account, then try again.";

const UNKNOWN = "Grok stopped without saying why.";

const AUTH_MARKERS = [
  "401",
  "grok login",
  "not logged in",
  "not signed in",
  "sign in",
  "unauthorized",
];

const USAGE_MARKERS = ["429", "credit", "quota", "rate limit", "usage limit"];

const MODEL_MARKERS = ["model not found", "unknown model", "unsupported model"];

export function failureFromText(text: string): AgentFailure {
  const kind = kindOfText(text);
  return { kind, message: readable(text, kind) };
}

// Nothing in-band is known for Grok yet: its login failures arrive as ACP
// errors, not as message text — measured via AUTH_REQUIRED on session/new.
export function inBandFailure(): AgentFailure | null {
  return null;
}

function kindOfText(text: string): AgentFailureKind {
  const haystack = text.toLowerCase();

  if (USAGE_MARKERS.some((marker) => haystack.includes(marker))) {
    return "usage";
  }
  if (AUTH_MARKERS.some((marker) => haystack.includes(marker))) {
    return "auth";
  }
  if (MODEL_MARKERS.some((marker) => haystack.includes(marker))) {
    return "model";
  }
  return "unknown";
}

function readable(text: string, kind: AgentFailureKind): string {
  if (kind === "auth") {
    return NOT_AUTHENTICATED;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN;
}
