import {
  ORG_POLICY_LIMIT_PREFIXES,
  type SDKAssistantMessageError,
  type SDKMessage,
  USAGE_LIMIT_ERROR_PREFIXES,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentFailure, AgentFailureKind } from "@/shared/ipc";
import { flatten } from "./events";

export const NOT_AUTHENTICATED =
  "Claude Code is not authenticated. Run `claude` in a terminal, log in with your Pro or Max account, then try again.";

const UNKNOWN = "Claude stopped without saying why.";

const BY_ASSISTANT_ERROR: Partial<
  Record<SDKAssistantMessageError, AgentFailureKind>
> = {
  authentication_failed: "auth",
  billing_error: "usage",
  model_not_found: "model",
  oauth_org_not_allowed: "auth",
  rate_limit: "usage",
};

const AUTH_MARKERS = [
  "/login",
  "authentication_error",
  "invalid api key",
  "invalid bearer token",
  "log in to claude",
  "not authenticated",
  "oauth token",
  "please run claude",
  "unauthorized",
];

const USAGE_MARKERS = [
  ...USAGE_LIMIT_ERROR_PREFIXES,
  ...ORG_POLICY_LIMIT_PREFIXES,
].map((prefix) => prefix.toLowerCase());

const MODEL_MARKERS = ["model_not_found", "unknown model"];

export function failureFromText(text: string): AgentFailure {
  const kind = kindOfText(text);
  return { kind, message: readable(text, kind) };
}

export function failureOf(message: SDKMessage): AgentFailure | null {
  if (message.type === "assistant" && message.error !== undefined) {
    const text = flatten(message.message.content);
    const kind = BY_ASSISTANT_ERROR[message.error] ?? kindOfText(text);
    return { kind, message: readable(text || message.error, kind) };
  }

  if (message.type === "result" && message.is_error) {
    return failureFromText(
      message.subtype === "success"
        ? message.result
        : message.errors.map((line) => line.trim()).join("; ")
    );
  }

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
