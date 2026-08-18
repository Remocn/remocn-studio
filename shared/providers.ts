import { Schema } from "effect";

export const AGENT_PROVIDERS = ["claude", "codex", "copilot"] as const;

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
  },
  // context is false because Codex reports per-turn token usage, not how full
  // the context window is; planTool is false because its todo_list item does
  // not speak the TaskCreate vocabulary the checklist parses. Experimental
  // until a real session has run the whole path from prompt to export.
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
  },
  // Speaks the Agent Client Protocol, which is why it gets real permission
  // cards where Codex has only the sandbox. Experimental for the same
  // reason Codex is — and the account this was built against is blocked by
  // an org policy, so the model path is verified against the protocol, not
  // against a live subscription.
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
