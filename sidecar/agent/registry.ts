import type { AgentProvider } from "@/shared/providers";
import { claudeAdapter } from "../claude/adapter";
import type { AgentAdapter } from "./adapter";

const ADAPTERS: Record<AgentProvider, AgentAdapter> = {
  claude: claudeAdapter,
};

export function adapterFor(provider: AgentProvider): AgentAdapter {
  return ADAPTERS[provider];
}
