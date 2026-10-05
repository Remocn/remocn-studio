import {
  SESSION_MODE_LABELS,
  SESSION_MODES,
  type SessionMode,
} from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

export interface ModelChoice {
  readonly label: string;
  readonly value: string;
}

export const CLAUDE_MODELS: readonly ModelChoice[] = [
  { label: "Fable 5.1", value: "claude-fable-5-1" },
  { label: "Fable 5", value: "claude-fable-5" },
  { label: "Opus 5.5", value: "claude-opus-5-5" },
  { label: "Opus 5", value: "claude-opus-5" },
  { label: "Sonnet 5.5", value: "claude-sonnet-5-5" },
  { label: "Sonnet 5", value: "claude-sonnet-5" },
  { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

// Auto is not a mode every model has. Claude Code takes `permissionMode: "auto"`
// from a model that cannot run it and quietly reports `default` back on
// `system`/`init` — so the studio has to know which ones, or the Mode chip
// claims a mode the turn did not run in. Measured one probe per model against
// the real CLI, reading the mode `init` answers with: Fable 5.1, Fable 5,
// Opus 5.5, Opus 5, Sonnet 5.5 and Sonnet 5 all run Auto; Haiku 4.5 comes
// back `default`.
const WITHOUT_AUTO: ReadonlySet<string> = new Set([
  "claude-haiku-4-5-20251001",
]);

// What a turn will really run in. The session keeps the mode the person picked
// — moving to a model that has Auto brings it back without them re-choosing —
// and only what is *shown* falls back, because the alternative is a chip that
// says Auto over a turn that asked about everything.
export type RunningMode = SessionMode | "default";

export function offersAutoMode(model: string): boolean {
  return !WITHOUT_AUTO.has(model);
}

export function runningMode(mode: SessionMode, model: string): RunningMode {
  return mode === "auto" && !offersAutoMode(model) ? "default" : mode;
}

export function runningModeLabel(mode: RunningMode): string {
  return mode === "default" ? "Default" : SESSION_MODE_LABELS[mode];
}

export interface ModeChoice {
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly label: string;
  readonly value: SessionMode;
}

export interface ModeChoices {
  readonly hint: string | null;
  readonly items: readonly ModeChoice[];
  readonly running: RunningMode;
}

const MODES: readonly ModeChoice[] = SESSION_MODES.map((mode) => ({
  label: SESSION_MODE_LABELS[mode],
  value: mode,
}));

const NO_MODEL_LIMITS: ReadonlySet<string> = new Set();

const AUTOLESS: Record<AgentProvider, ReadonlySet<string>> = {
  claude: WITHOUT_AUTO,
  codex: NO_MODEL_LIMITS,
  copilot: NO_MODEL_LIMITS,
  grok: NO_MODEL_LIMITS,
};

export function modeChoices(
  provider: AgentProvider,
  mode: SessionMode,
  model: string
): ModeChoices {
  if (!AUTOLESS[provider].has(model)) {
    return { hint: null, items: MODES, running: mode };
  }

  const name = modelLabelOf(provider, model);
  const running = runningMode(mode, model);

  return {
    hint:
      running === mode
        ? null
        : `${name} does not offer ${SESSION_MODE_LABELS[mode]}`,
    items: MODES.map((item) =>
      item.value === "auto"
        ? { ...item, disabled: true, hint: `${name} does not offer this mode` }
        : item
    ),
    running,
  };
}

// Codex's catalog is dynamic and account-shaped: thirteen explicit gpt-5.x
// slugs from the CLI source and the wider lineup were probed against a
// ChatGPT login (codex-cli 0.147.0) and every one answered 400 except Terra
// and Luna. Sol is the third sibling in the source — refused on the probed
// plan, plausibly open on higher tiers, and a refusal fails the turn with
// the router's own sentence. "Default" (no model at all) is the one entry
// that can never drift, so it leads. Astra is gated by the CLI, not the
// plan: measured on the same login, codex-cli 0.148.0 answers 400 *"The
// 'gpt-6-astra' model requires a newer version of Codex"* and 0.153.4 —
// the first release carrying the slug — runs it. The GPT-6 Sol and Luna pair
// and GPT-6.1 Sol follow the same gate: 0.153.4 answers 400 *"The
// 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT
// account"* and 0.159.3 runs all three on the same login.
export const CODEX_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "GPT-6.1 Sol", value: "gpt-6.1-sol" },
  { label: "GPT-6 Astra", value: "gpt-6-astra" },
  { label: "GPT-6 Sol", value: "gpt-6-sol" },
  { label: "GPT-6 Luna", value: "gpt-6-luna" },
  { label: "GPT-5.6 Terra", value: "gpt-5.6-terra" },
  { label: "GPT-5.6 Luna", value: "gpt-5.6-luna" },
  { label: "GPT-5.6 Sol", value: "gpt-5.6-sol" },
];

// A curated head of the 32 models `copilot help config` documents (CLI
// 1.0.90) — Copilot is a router over other vendors' models, so the group
// samples one strong entry per family rather than mirroring the whole
// catalog. Which of them an account may actually use is plan-shaped; a
// refused model fails the turn with the router's own sentence. "Default"
// is `auto` — Copilot picks — and cannot drift.
export const COPILOT_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "Claude Fable 5.1", value: "claude-fable-5.1" },
  { label: "Claude Opus 5.5", value: "claude-opus-5.5" },
  { label: "Claude Sonnet 5.5", value: "claude-sonnet-5.5" },
  { label: "GPT-6.1 Sol", value: "gpt-6.1-sol" },
  { label: "GPT-6 Astra", value: "gpt-6-astra" },
  { label: "Gemini 3.8 Flash", value: "gemini-3.8-flash" },
  { label: "Grok 4.6", value: "grok-4.6" },
];

// Measured live with `grok models` against a grok.com login (grok 1.0.44):
// 4.7 is the default, 4.7 Fast its quicker variant, 4.6 and 4.5 behind.
export const GROK_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "Grok 4.7", value: "grok-4.7" },
  { label: "Grok 4.7 Fast", value: "grok-4.7-build-fast" },
  { label: "Grok 4.6", value: "grok-4.6" },
  { label: "Grok 4.5", value: "grok-4.5" },
];

export const PROVIDER_MODELS: Record<AgentProvider, readonly ModelChoice[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  copilot: COPILOT_MODELS,
  grok: GROK_MODELS,
};

export const DEFAULT_MODELS: Record<AgentProvider, string> = {
  claude: DEFAULT_CLAUDE_MODEL,
  codex: "",
  copilot: "",
  grok: "",
};

export function modelLabelOf(provider: AgentProvider, value: string): string {
  const found = PROVIDER_MODELS[provider].find(
    (choice) => choice.value === value
  );
  return found?.label ?? (value.length > 0 ? value : "Default");
}
