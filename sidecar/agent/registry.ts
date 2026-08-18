import type { AgentProvider } from "@/shared/providers";
import { claudeAdapter } from "../claude/adapter";
import { codexAdapter } from "../codex/adapter";
import { copilotAdapter } from "../copilot/adapter";
import { grokAdapter } from "../grok/adapter";
import type { AgentAdapter } from "./adapter";

const ADAPTERS: Record<AgentProvider, AgentAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  copilot: copilotAdapter,
  grok: grokAdapter,
};

export function adapterFor(provider: AgentProvider): AgentAdapter {
  return ADAPTERS[provider];
}
