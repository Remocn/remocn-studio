// Run under bun by pipes.test.ts, which closes this process's stdout before
// it says go: the exact shape REM-651 reported. With `--plain` it writes the
// way every entry point did before the guard, and bun raises the EPIPE as an
// unhandled rejection; guarded, nothing is raised, and a race that starts
// after the break still reads it as a reason.
import { once } from "node:events";
import { createInterface } from "node:readline";
import { Effect, Option } from "effect";
import { guardPipes, untilBroken } from "./pipes";

const raised: string[] = [];
const note = (error: unknown) => {
  raised.push((error as { code?: string }).code ?? String(error));
};
process.on("unhandledRejection", note);
process.on("uncaughtException", note);

const plain = process.argv.includes("--plain");

if (!plain) {
  Effect.runSync(guardPipes);
}

const lines = createInterface({ input: process.stdin });
await once(lines, "line");
lines.close();

process.stdout.write("a frame nobody reads\n");
await new Promise((resolve) => setTimeout(resolve, 100));
process.stdout.write("and one more after the break\n");
await new Promise((resolve) => setTimeout(resolve, 100));

const reason = plain
  ? null
  : Option.getOrNull(
      await Effect.runPromise(
        untilBroken(process.stdout, "the host closed stdout").pipe(
          Effect.timeoutOption("1 second")
        )
      )
    );

process.stderr.write(JSON.stringify({ raised, reason }));
process.exit(0);
