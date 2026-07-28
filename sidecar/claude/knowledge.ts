import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { PLUGIN_DIR_ENV } from "@/shared/ipc";

export const VENDORED = [
  "remocn",
  "remotion-best-practices",
  "remotion-interactivity",
] as const;

export function pluginsFor(cwd: string): NonNullable<Options["plugins"]> {
  const dir = process.env[PLUGIN_DIR_ENV];

  if (dir === undefined || !existsSync(dir)) {
    return [];
  }

  if (installedIn(cwd)) {
    return [];
  }

  return [{ path: dir, type: "local" }];
}

export function installedIn(cwd: string): boolean {
  return VENDORED.some((skill) =>
    existsSync(join(cwd, ".claude", "skills", skill))
  );
}
