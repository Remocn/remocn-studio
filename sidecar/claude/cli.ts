import { homedir } from "node:os";
import { fallbackDirs, findExecutable, type LookupHost } from "../agent/cli";

export const CLAUDE_ENV = "REMOCN_STUDIO_CLAUDE";

export const CLAUDE_FALLBACK_DIRS = fallbackDirs(homedir(), [".claude/local"]);

export const CLAUDE_LOOKUP = {
  env: CLAUDE_ENV,
  fallbacks: CLAUDE_FALLBACK_DIRS,
  name: "claude",
} as const;

export function findClaude(at?: LookupHost): string | null {
  return findExecutable(CLAUDE_LOOKUP, at);
}
