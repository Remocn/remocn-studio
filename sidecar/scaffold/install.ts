import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect } from "effect";
import { ScaffoldError } from "./template";

const KILL_GRACE_MS = 2000;
const TAIL_LINES = 12;

export function installDependencies(
  cwd: string,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<void, ScaffoldError> {
  return Effect.callback<void, ScaffoldError>((resume) => {
    const child = spawn(process.execPath, ["install"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const tail: string[] = [];

    const watch = (stream: NodeJS.ReadableStream | null) => {
      if (stream === null) {
        return;
      }
      const lines = createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: stream,
      });
      lines.on("line", (line) => {
        tail.push(line);
        if (tail.length > TAIL_LINES) {
          tail.shift();
        }
        Effect.runSync(log(`install: ${line}`));
      });
    };

    watch(child.stdout);
    watch(child.stderr);

    child.once("error", (cause) => {
      resume(Effect.fail(new ScaffoldError({ message: String(cause) })));
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resume(Effect.void);
        return;
      }
      resume(
        Effect.fail(
          new ScaffoldError({
            message: reason(code, signal, tail),
          })
        )
      );
    });

    return Effect.sync(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
      }
    });
  });
}

function reason(
  code: number | null,
  signal: NodeJS.Signals | null,
  tail: readonly string[]
): string {
  const how =
    signal === null ? `exited with code ${code}` : `was killed by ${signal}`;
  const said = tail.join("\n").trim();

  return said.length === 0
    ? `bun install ${how}`
    : `bun install ${how}:\n${said}`;
}
