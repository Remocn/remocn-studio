import type { AgentFailure, AgentFailureKind } from "@/shared/ipc";
import { NOT_AUTHENTICATED } from "./account";

const UNKNOWN = "Codex stopped without saying why.";

const AUTH_MARKERS = [
  "401",
  "authentication",
  "codex login",
  "not logged in",
  "unauthorized",
];

const USAGE_MARKERS = ["429", "quota", "rate limit", "usage limit"];

const MODEL_MARKERS = ["model not found", "unknown model", "unsupported model"];

export function failureFromText(text: string): AgentFailure {
  const kind = kindOfText(text);
  return { kind, message: readable(text, kind) };
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
