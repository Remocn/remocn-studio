import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, Schema, Stream } from "effect";
import { DATA_DIR_ENV, PREVIEW_ENTRY_ENV, PreviewEvent } from "@/shared/ipc";
import { PREVIEW_OUT_ENV, PREVIEW_PARENT_ENV } from "./host";
import { PreviewError } from "./project";

export const PREVIEW_HOST_FLAG = "--preview-host";

const KILL_GRACE_MS = 2000;

const decodeEvent = Schema.decodeExit(Schema.fromJsonString(PreviewEvent));

export function previewEvents(
  folder: string,
  log: (message: string) => Effect.Effect<void>
): Stream.Stream<PreviewEvent, PreviewError> {
  return Stream.unwrap(
    Effect.map(child(folder, log), (process_) =>
      Stream.flatMap(lines(process_), (line) => {
        const decoded = decodeEvent(line);
        return Exit.isSuccess(decoded)
          ? Stream.succeed(decoded.value)
          : Stream.empty;
      })
    )
  );
}

function child(folder: string, log: (message: string) => Effect.Effect<void>) {
  return Effect.acquireRelease(spawnHost(folder, log), (process_) =>
    stop(process_)
  );
}

function spawnHost(
  folder: string,
  log: (message: string) => Effect.Effect<void>
) {
  return Effect.gen(function* () {
    const entry = process.env[PREVIEW_ENTRY_ENV];

    if (entry === undefined) {
      return yield* Effect.fail(
        new PreviewError({
          message: `${PREVIEW_ENTRY_ENV} is not set, so there is no preview entry to compile`,
        })
      );
    }

    const outDir = outDirFor(folder);

    const spawned = yield* Effect.try({
      catch: (cause) => new PreviewError({ message: String(cause) }),
      try: () =>
        spawn(process.execPath, [scriptPath(), PREVIEW_HOST_FLAG], {
          cwd: folder,
          env: {
            ...process.env,
            [PREVIEW_ENTRY_ENV]: entry,
            [PREVIEW_OUT_ENV]: outDir,
            [PREVIEW_PARENT_ENV]: String(process.pid),
          },
          stdio: ["pipe", "pipe", "pipe"],
        }),
    });

    yield* Effect.forkScoped(drainStderr(spawned, log));

    yield* log(`preview host for ${folder} started as pid ${spawned.pid}`);

    return spawned;
  });
}

function lines(process_: ChildProcess): Stream.Stream<string, PreviewError> {
  return Stream.suspend(() => {
    if (process_.stdout === null) {
      return Stream.fail(
        new PreviewError({ message: "the preview host has no stdout" })
      );
    }

    return Stream.fromAsyncIterable(
      createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: process_.stdout,
      }),
      (cause) => new PreviewError({ message: String(cause) })
    );
  });
}

function drainStderr(
  process_: ChildProcess,
  log: (message: string) => Effect.Effect<void>
): Effect.Effect<void> {
  if (process_.stderr === null) {
    return Effect.void;
  }

  return Stream.runForEach(
    Stream.fromAsyncIterable(
      createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: process_.stderr,
      }),
      () => undefined
    ),
    (line) => log(`preview: ${line}`)
  ).pipe(Effect.ignore);
}

function stop(process_: ChildProcess): Effect.Effect<void> {
  return Effect.callback<void>((resume) => {
    if (process_.exitCode !== null || process_.signalCode !== null) {
      resume(Effect.void);
      return;
    }

    const timer = setTimeout(() => {
      process_.kill("SIGKILL");
    }, KILL_GRACE_MS);

    process_.once("exit", () => {
      clearTimeout(timer);
      resume(Effect.void);
    });

    process_.kill("SIGTERM");

    return Effect.sync(() => {
      clearTimeout(timer);
    });
  });
}

function scriptPath(): string {
  return process.argv[1] ?? "";
}

function outDirFor(folder: string): string {
  const base = process.env[DATA_DIR_ENV] ?? tmpdir();
  const key = createHash("sha256").update(folder).digest("hex").slice(0, 16);
  const dir = path.join(base, "preview", key);

  mkdirSync(dir, { recursive: true });

  return dir;
}
