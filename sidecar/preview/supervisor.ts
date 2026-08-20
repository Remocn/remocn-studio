import { type ChildProcess, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, Schema, type Scope, Stream } from "effect";
import {
  DATA_DIR_ENV,
  type ExportEvent,
  type Exported,
  PREVIEW_ENTRY_ENV,
  PreviewEvent,
  type Still,
  type StillEvent,
} from "@/shared/ipc";
import type { DesignResult } from "./design";
import { PREVIEW_OUT_ENV, PREVIEW_PARENT_ENV } from "./host";
import { PreviewError } from "./project";
import { decodeHostReply, type HostCommand, type HostReply } from "./protocol";

export const PREVIEW_HOST_FLAG = "--preview-host";

const KILL_GRACE_MS = 2000;

const decodeEvent = Schema.decodeExit(Schema.fromJsonString(PreviewEvent));

type Pending =
  | {
      fail: (message: string) => void;
      kind: "export";
      progress: (event: ExportEvent) => void;
      succeed: (exported: Exported) => void;
    }
  | {
      fail: (message: string) => void;
      kind: "still";
      progress: (event: StillEvent) => void;
      succeed: (still: Still | null) => void;
    }
  | {
      fail: (message: string) => void;
      kind: "clip";
      succeed: (path: string) => void;
    }
  | {
      fail: (message: string) => void;
      kind: "design";
      succeed: (result: DesignResult) => void;
    };

type ExportPending = Extract<Pending, { kind: "export" }>;
type StillPending = Extract<Pending, { kind: "still" }>;

const failed = (message: string) => new PreviewError({ message });

interface Host {
  pending: Map<string, Pending>;
  send: (command: HostCommand) => boolean;
}

const hosts = new Map<string, Host>();

export interface StillRequest {
  composition: string;
  frame: number;
}

export interface DesignRequest {
  composition: string;
  frames: readonly number[];
}

export function previewEvents(
  projectId: string,
  folder: string,
  log: (message: string) => Effect.Effect<void>
): Stream.Stream<PreviewEvent, PreviewError> {
  return Stream.unwrap(
    Effect.gen(function* () {
      const process_ = yield* child(folder, log);
      const host = hostOf(process_);

      yield* enrol(projectId, host);

      return Stream.flatMap(lines(process_), (line) => {
        const event = route(line, host.pending);
        return event === null ? Stream.empty : Stream.succeed(event);
      });
    })
  );
}

export function stillFrom(
  projectId: string,
  request: StillRequest,
  onEvent: (event: StillEvent) => void
): Effect.Effect<Still, PreviewError> {
  return ask<Still | null>(
    projectId,
    (id) => ({ ...request, id, type: "still" }),
    (settle) => ({
      fail: (message) => settle(Effect.fail(failed(message))),
      kind: "still",
      progress: onEvent,
      succeed: (still) => settle(Effect.succeed(still)),
    })
  ).pipe(
    Effect.flatMap((still) =>
      still === null
        ? Effect.fail(failed("the preview host answered without a frame"))
        : Effect.succeed(still)
    )
  );
}

export function designFrom(
  projectId: string,
  request: DesignRequest
): Effect.Effect<DesignResult, PreviewError> {
  return ask<DesignResult>(
    projectId,
    (id) => ({ ...request, frames: [...request.frames], id, type: "design" }),
    (settle) => ({
      fail: (message) => settle(Effect.fail(failed(message))),
      kind: "design",
      succeed: (result) => settle(Effect.succeed(result)),
    })
  );
}

export function warmFrom(
  projectId: string,
  composition: string
): Effect.Effect<void, PreviewError> {
  return Effect.asVoid(
    ask<Still | null>(
      projectId,
      (id) => ({ composition, id, type: "warm" }),
      (settle) => ({
        fail: (message) => settle(Effect.fail(failed(message))),
        kind: "still",
        progress: () => undefined,
        succeed: (still) => settle(Effect.succeed(still)),
      })
    )
  );
}

export function clipFrom(
  projectId: string,
  request: StillRequest
): Effect.Effect<string, PreviewError> {
  return ask<string>(
    projectId,
    (id) => ({ ...request, id, type: "clip" }),
    (settle) => ({
      fail: (message) => settle(Effect.fail(failed(message))),
      kind: "clip",
      succeed: (written) => settle(Effect.succeed(written)),
    })
  );
}

export function exportFrom(
  projectId: string,
  composition: string,
  onEvent: (event: ExportEvent) => void
): Effect.Effect<Exported, PreviewError> {
  return ask<Exported>(
    projectId,
    (id) => ({ composition, id, type: "export" }),
    (settle) => ({
      fail: (message) => settle(Effect.fail(failed(message))),
      kind: "export",
      progress: onEvent,
      succeed: (exported) => settle(Effect.succeed(exported)),
    })
  );
}

function ask<A>(
  projectId: string,
  command: (id: string) => HostCommand,
  waiting: (
    settle: (outcome: Effect.Effect<A, PreviewError>) => void
  ) => Pending
): Effect.Effect<A, PreviewError> {
  return Effect.suspend(() => {
    const host = hosts.get(projectId);

    if (host === undefined) {
      return Effect.fail(
        failed(
          "the preview is not running for this project, so there is nothing to render"
        )
      );
    }

    return Effect.callback<A, PreviewError>((resume) => {
      const id = randomUUID();

      const settle = (outcome: Effect.Effect<A, PreviewError>) => {
        host.pending.delete(id);
        resume(outcome);
      };

      host.pending.set(id, waiting(settle));

      if (!host.send(command(id))) {
        settle(
          Effect.fail(failed("the preview host is not accepting commands"))
        );
        return;
      }

      return Effect.sync(() => {
        if (host.pending.delete(id)) {
          host.send({ id, type: "cancel" });
        }
      });
    });
  });
}

function hostOf(process_: ChildProcess): Host {
  return {
    pending: new Map<string, Pending>(),
    send: (command) => {
      const { stdin } = process_;

      if (stdin === null || !stdin.writable) {
        return false;
      }

      stdin.write(`${JSON.stringify(command)}\n`);
      return true;
    },
  };
}

function enrol(
  projectId: string,
  host: Host
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      hosts.set(projectId, host);
    }),
    () =>
      Effect.sync(() => {
        if (hosts.get(projectId) === host) {
          hosts.delete(projectId);
        }

        for (const waiting of [...host.pending.values()]) {
          waiting.fail("the preview stopped before it finished");
        }
      })
  );
}

function route(
  line: string,
  pending: Map<string, Pending>
): PreviewEvent | null {
  const reply = decodeHostReply(line);

  if (Exit.isSuccess(reply)) {
    deliver(reply.value, pending);
    return null;
  }

  const event = decodeEvent(line);

  return Exit.isSuccess(event) ? event.value : null;
}

function deliver(reply: HostReply, pending: Map<string, Pending>): void {
  const waiting = pending.get(reply.id);

  if (waiting === undefined) {
    return;
  }

  if (
    reply.type === "still-failed" ||
    reply.type === "export-failed" ||
    reply.type === "clip-failed" ||
    reply.type === "design-failed"
  ) {
    waiting.fail(reply.message);
    return;
  }

  if (waiting.kind === "clip") {
    if (reply.type === "clip-done") {
      waiting.succeed(reply.path);
    }
    return;
  }

  if (waiting.kind === "design") {
    if (reply.type === "design-done") {
      waiting.succeed(reply.result);
    }
    return;
  }

  if (waiting.kind === "export") {
    toExport(reply, waiting);
    return;
  }

  toStill(reply, waiting);
}

function toExport(reply: HostReply, waiting: ExportPending): void {
  if (reply.type === "export-progress") {
    waiting.progress(reply.event);
    return;
  }

  if (reply.type === "export-done") {
    waiting.succeed(reply.exported);
  }
}

function toStill(reply: HostReply, waiting: StillPending): void {
  if (reply.type === "still-progress") {
    waiting.progress(reply.event);
    return;
  }

  if (reply.type === "still-done") {
    waiting.succeed(reply.still);
    return;
  }

  if (reply.type === "warm-done") {
    waiting.succeed(null);
  }
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
