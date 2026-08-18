import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export const CODEX_ENV = "REMOCN_STUDIO_CODEX";

// The app does not bundle Codex, exactly as it does not bundle bun or the
// Claude CLI: the whole point is the user's own logged-in tool. A GUI-launched
// app gets a minimal PATH, which is why the fallback list exists.
const FALLBACK_DIRS = [
  join(homedir(), ".bun", "bin"),
  join(homedir(), ".npm-global", "bin"),
  join(homedir(), ".local", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export function findCodex(): string | null {
  const overridden = process.env[CODEX_ENV];
  if (overridden !== undefined && overridden.length > 0) {
    return existsSync(overridden) ? overridden : null;
  }

  const onPath = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir.length > 0);

  for (const dir of [...onPath, ...FALLBACK_DIRS]) {
    const candidate = join(dir, "codex");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export interface CliRun {
  readonly code: number | null;
  readonly output: string;
}

export function runCodex(
  executable: string,
  args: readonly string[],
  timeoutMs: number
): Promise<CliRun> {
  return new Promise((settle) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.once("error", (cause) => {
      clearTimeout(timer);
      settle({ code: null, output: cause.message });
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      settle({ code, output });
    });
  });
}
