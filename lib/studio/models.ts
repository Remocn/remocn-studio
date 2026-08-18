import type { AgentProvider } from "@/shared/providers";

export interface ModelChoice {
  readonly label: string;
  readonly value: string;
}

export const CLAUDE_MODELS: readonly ModelChoice[] = [
  { label: "Fable 5", value: "claude-fable-5" },
  { label: "Opus 5", value: "claude-opus-5" },
  { label: "Sonnet 5", value: "claude-sonnet-5" },
  { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

// Codex's catalog is dynamic and account-shaped: every explicit gpt-5.x slug
// from the CLI source was refused for a ChatGPT login except these two,
// measured against codex-cli 0.147.0 — and "Default" (no model at all) is the
// one entry that can never drift, so it leads.
export const CODEX_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "GPT-5.6 Terra", value: "gpt-5.6-terra" },
  { label: "GPT-5.6 Luna", value: "gpt-5.6-luna" },
];

// A curated head of the 27 models `copilot help config` documents (CLI
// 1.0.80) — Copilot is a router over other vendors' models, so the group
// samples one strong entry per family rather than mirroring the whole
// catalog. Which of them an account may actually use is plan-shaped; a
// refused model fails the turn with the router's own sentence. "Default"
// is `auto` — Copilot picks — and cannot drift.
export const COPILOT_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "Claude Sonnet 5", value: "claude-sonnet-5" },
  { label: "Claude Opus 5", value: "claude-opus-5" },
  { label: "GPT-5.6 Terra", value: "gpt-5.6-terra" },
  { label: "Gemini 3.1 Pro", value: "gemini-3.1-pro-preview" },
  { label: "Grok 4.5", value: "grok-4.5" },
];

export const PROVIDER_MODELS: Record<AgentProvider, readonly ModelChoice[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  copilot: COPILOT_MODELS,
};

export const DEFAULT_MODELS: Record<AgentProvider, string> = {
  claude: DEFAULT_CLAUDE_MODEL,
  codex: "",
  copilot: "",
};

export function modelLabelOf(provider: AgentProvider, value: string): string {
  const found = PROVIDER_MODELS[provider].find(
    (choice) => choice.value === value
  );
  return found?.label ?? (value.length > 0 ? value : "Default");
}
