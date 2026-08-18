import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export const COPILOT_ENV = "REMOCN_STUDIO_COPILOT";

// The same resolution the Codex CLI gets: the user's own logged-in tool,
// never a bundled one, with the fallback list a GUI-launched app's minimal
// PATH makes necessary.
const FALLBACK_DIRS = [
  join(homedir(), ".bun", "bin"),
  join(homedir(), ".npm-global", "bin"),
  join(homedir(), ".local", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export function findCopilot(): string | null {
  const overridden = process.env[COPILOT_ENV];
  if (overridden !== undefined && overridden.length > 0) {
    return existsSync(overridden) ? overridden : null;
  }

  const onPath = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir.length > 0);

  for (const dir of [...onPath, ...FALLBACK_DIRS]) {
    const candidate = join(dir, "copilot");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
