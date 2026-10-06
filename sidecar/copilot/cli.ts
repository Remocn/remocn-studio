import { homedir } from "node:os";
import { fallbackDirs, findExecutable, type LookupHost } from "../agent/cli";

export const COPILOT_ENV = "REMOCN_STUDIO_COPILOT";

const FALLBACK_DIRS = fallbackDirs(homedir());

export function findCopilot(at?: LookupHost): string | null {
  return findExecutable(
    { env: COPILOT_ENV, fallbacks: FALLBACK_DIRS, name: "copilot" },
    at
  );
}
