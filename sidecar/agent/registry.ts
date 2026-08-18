import type { AgentProvider } from "@/shared/providers";
import { claudeAdapter } from "../claude/adapter";
import { codexAdapter } from "../codex/adapter";
import { copilotAdapter } from "../copilot/adapter";
import type { AgentAdapter } from "./adapter";

const ADAPTERS: Record<AgentProvider, AgentAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  copilot: copilotAdapter,
};

export function adapterFor(provider: AgentProvider): AgentAdapter {
  return ADAPTERS[provider];
}
