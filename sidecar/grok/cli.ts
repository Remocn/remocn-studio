import { homedir } from "node:os";
import { fallbackDirs, findExecutable, type LookupHost } from "../agent/cli";

export const GROK_ENV = "REMOCN_STUDIO_GROK";

const FALLBACK_DIRS = fallbackDirs(homedir(), [".grok/bin"]);

export function findGrok(at?: LookupHost): string | null {
  return findExecutable(
    { env: GROK_ENV, fallbacks: FALLBACK_DIRS, name: "grok" },
    at
  );
}
