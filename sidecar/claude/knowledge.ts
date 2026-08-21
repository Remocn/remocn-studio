import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { KnowledgeBundle } from "../agent/knowledge";

export function pluginsFor(
  bundle: KnowledgeBundle
): NonNullable<Options["plugins"]> {
  return bundle.loaded && bundle.path !== null
    ? [{ path: bundle.path, type: "local" }]
    : [];
}
