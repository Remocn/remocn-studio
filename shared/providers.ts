import { Schema } from "effect";

export const AGENT_PROVIDERS = ["claude", "codex", "copilot", "grok"] as const;

export const AgentProvider = Schema.Literals(AGENT_PROVIDERS);

export type AgentProvider = (typeof AgentProvider)["Type"];

export const DEFAULT_AGENT_PROVIDER: AgentProvider = "claude";

export function isAgentProvider(value: unknown): value is AgentProvider {
  return (
    typeof value === "string" &&
    (AGENT_PROVIDERS as readonly string[]).includes(value)
  );
}

export const AgentCapabilities = Schema.Struct({
  context: Schema.Boolean,
  effort: Schema.Boolean,
  modes: Schema.Boolean,
  planTool: Schema.Boolean,
  resume: Schema.Boolean,
  thinking: Schema.Boolean,
});

export type AgentCapabilities = (typeof AgentCapabilities)["Type"];

export const ProviderInfo = Schema.Struct({
  capabilities: AgentCapabilities,
  experimental: Schema.Boolean,
  id: AgentProvider,
  name: Schema.String,
  planningTool: Schema.NullOr(Schema.String),
});

export type ProviderInfo = (typeof ProviderInfo)["Type"];

// The webview and the sidecar ship in one bundle, so a static table cannot
// drift from the adapters the sidecar actually carries — and the chips never
// need a loading state. A capability discovered at run time would need a
// method instead; none exists yet.
export const PROVIDER_INFO: Record<AgentProvider, ProviderInfo> = {
  claude: {
    capabilities: {
      context: true,
      effort: true,
      modes: true,
      planTool: true,
      resume: true,
      thinking: true,
    },
    experimental: false,
    id: "claude",
    name: "Claude",
    planningTool: "TaskCreate",
  },
  // context is false because Codex reports per-turn token usage, not how full
  // the context window is; planTool is false because its todo_list item does
  // not speak the TaskCreate vocabulary the checklist parses. Its own plan
  // tool is update_plan (codex-rs core/src/tools/handlers/plan.rs, present in
  // the 0.147.0 binary). Experimental until a real session has run the whole
  // path from prompt to export.
  codex: {
    capabilities: {
      context: false,
      effort: true,
      modes: true,
      planTool: false,
      resume: true,
      thinking: true,
    },
    experimental: true,
    id: "codex",
    name: "Codex",
    planningTool: "update_plan",
  },
  // Speaks the Agent Client Protocol, which is why it gets real permission
  // cards where Codex has only the sandbox. Experimental for the same
  // reason Codex is — and the account this was built against is blocked by
  // an org policy, so the model path is verified against the protocol, not
  // against a live subscription. Its plan tool's name could not be read off
  // the 1.0.90 bundle, so no planningTool is claimed.
  copilot: {
    capabilities: {
      context: false,
      effort: true,
      modes: true,
      planTool: false,
      resume: true,
      thinking: true,
    },
    experimental: true,
    id: "copilot",
    name: "Copilot",
    planningTool: null,
  },
  // The second rider on the ACP bridge. Its prompt capabilities say
  // image: false, so attached pictures degrade to a notice rather than a
  // silent drop. Its plan tool is todo_write, read off the Grok Build 1.0.46
  // binary's own tool table.
  grok: {
    capabilities: {
      context: false,
      effort: true,
      modes: true,
      planTool: false,
      resume: true,
      thinking: true,
    },
    experimental: true,
    id: "grok",
    name: "Grok",
    planningTool: "todo_write",
  },
};

export function capabilitiesOf(provider: AgentProvider): AgentCapabilities {
  return PROVIDER_INFO[provider].capabilities;
}

export const TOOL_VERBS = [
  "create",
  "edit",
  "find",
  "plan",
  "read",
  "run",
  "search",
  "subagent",
  "task",
  "web",
] as const;

export const ToolVerb = Schema.Literals(TOOL_VERBS);

export type ToolVerb = (typeof ToolVerb)["Type"];

export const PROVIDER_STEPS = ["install", "signin"] as const;

export const ProviderStep = Schema.Literals(PROVIDER_STEPS);

export type ProviderStep = (typeof ProviderStep)["Type"];

export interface SetupStep {
  readonly command: string;
  readonly url: string | null;
}

export interface ProviderSetup {
  readonly cli: string;
  readonly install: SetupStep;
  readonly note: string | null;
  readonly signin: SetupStep;
}

export const PROVIDER_SETUP: Record<AgentProvider, ProviderSetup> = {
  claude: {
    cli: "Claude Code",
    install: {
      command: "curl -fsSL https://claude.ai/install.sh | bash",
      url: "https://docs.claude.com/en/docs/claude-code/setup",
    },
    note: "Being signed in to Claude Desktop does not count: Claude Code is a separate app with its own login.",
    signin: { command: "claude auth login", url: null },
  },
  codex: {
    cli: "Codex CLI",
    install: {
      command: "npm install -g @openai/codex",
      url: "https://developers.openai.com/codex/cli",
    },
    note: null,
    signin: { command: "codex login", url: null },
  },
  copilot: {
    cli: "Copilot CLI",
    install: {
      command: "npm install -g @github/copilot",
      url: "https://docs.github.com/copilot/how-tos/copilot-cli",
    },
    note: null,
    signin: { command: "copilot login", url: null },
  },
  grok: {
    cli: "Grok Build",
    install: {
      command: "curl -fsSL https://x.ai/cli/install.sh | bash",
      url: "https://grok.com/build",
    },
    note: null,
    signin: { command: "grok login", url: null },
  },
};
