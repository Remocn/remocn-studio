import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export const GROK_ENV = "REMOCN_STUDIO_GROK";

// Grok Build installs itself into ~/.grok/bin, which its installer also puts
// on PATH — the fallback list is for the minimal PATH a GUI-launched app
// gets, the same story bun, codex and copilot already have.
const FALLBACK_DIRS = [
  join(homedir(), ".grok", "bin"),
  join(homedir(), ".local", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export function findGrok(): string | null {
  const overridden = process.env[GROK_ENV];
  if (overridden !== undefined && overridden.length > 0) {
    return existsSync(overridden) ? overridden : null;
  }

  const onPath = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir.length > 0);

  for (const dir of [...onPath, ...FALLBACK_DIRS]) {
    const candidate = join(dir, "grok");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
