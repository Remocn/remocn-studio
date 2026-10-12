import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { fallbackDirs, findExecutable, type LookupHost } from "../agent/cli";

export const CODEX_ENV = "REMOCN_STUDIO_CODEX";

const FALLBACK_DIRS = fallbackDirs(homedir());

export function findCodex(at?: LookupHost): string | null {
  return findExecutable(
    { env: CODEX_ENV, fallbacks: FALLBACK_DIRS, name: "codex" },
    at
  );
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
