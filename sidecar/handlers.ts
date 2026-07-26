import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Clock, Effect, Ref, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  type ClaudeFailure,
  type ContextUsage,
  type Project,
  type SessionMode,
  SIDECAR_PROTOCOL,
} from "@/shared/ipc";
import { eventsOf } from "./claude/events";
import { failureFromText, failureOf } from "./claude/failure";
import { makeGate, permissionGuard } from "./claude/gate";
import { makeModeSwitch } from "./claude/mode";
import { messages } from "./claude/session";
import { ProjectStore } from "./history/projects";
import { recording } from "./history/recorder";
import { type HistoryError, HistoryStore } from "./history/store";
import { HandlerError, type Handlers } from "./host";
import { previewEvents } from "./preview/supervisor";
import { installDependencies } from "./scaffold/install";
import { expandTemplate, type ScaffoldError } from "./scaffold/template";

const TOKENS = [
  "Streaming",
  "straight",
  "out",
  "of",
  "the",
  "bun",
  "sidecar",
  "—",
  "one",
  "frame",
  "at",
  "a",
  "time.",
];

const MAX_COUNT = 500;
const MAX_DELAY_MS = 2000;

const gate = makeGate();

const unstored = (error: HistoryError) =>
  new HandlerError({ message: error.message });

const unscaffolded = (error: ScaffoldError) =>
  new HandlerError({ message: error.message });

const onDisk = (project: Project) =>
  project.missing
    ? Effect.fail(
        new HandlerError({
          message: `${project.name} is not on disk anymore — ${project.path} is gone`,
        })
      )
    : Effect.succeed(project);

const located = (projectId: string) =>
  Effect.flatMap(ProjectStore, (projects) => projects.find(projectId)).pipe(
    Effect.mapError(unstored),
    Effect.flatMap(onDisk)
  );

export const handlers: Handlers<HistoryStore | ProjectStore> = {
  "claude.permission": ({ params }) =>
    Effect.map(
      gate.answer(params.id, params.decision, params.mode),
      (matched) => ({ matched })
    ),

  "claude.prompt": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const turnId = yield* Effect.sync(() => crypto.randomUUID());
      const project = yield* located(params.projectId);
      const sessionId = yield* Ref.make(params.sessionId);
      const failure = yield* Ref.make<ClaudeFailure | null>(null);
      const context = yield* Ref.make<ContextUsage | null>(null);

      const store = yield* HistoryStore;
      const recorder = yield* recording(store, params, log);
      if (recorder.session !== null) {
        yield* emit({ session: recorder.session, type: "history" });
      }

      const switcher = yield* makeModeSwitch();

      const approved = (mode: SessionMode) =>
        switcher.set(mode).pipe(
          Effect.andThen(
            store.setMode(params.historyId, mode).pipe(
              Effect.flatMap((session) => emit({ session, type: "history" })),
              Effect.catch((error) => log(`history: ${error.message}`))
            )
          )
        );

      yield* Stream.runForEach(
        messages(params, {
          canUseTool: permissionGuard({
            cwd: project.path,
            emit,
            gate,
            onApprove: approved,
            turnId,
          }),
          cwd: project.path,
          log: (line) => Effect.runSync(log(line)),
          onContext: (usage) => Effect.runSync(Ref.set(context, usage)),
          onMode: (apply) => Effect.runSync(switcher.bind(apply)),
          onStop: () => Effect.runSync(gate.abandon(turnId)),
        }),
        (message) =>
          Effect.gen(function* () {
            if (message.type === "system" && message.subtype === "init") {
              yield* Ref.set(sessionId, message.session_id);
            }

            const found = failureOf(message);
            if (found !== null) {
              yield* Ref.set(failure, found);
            }

            yield* Effect.forEach(
              eventsOf(message, params.mode),
              (event) => Effect.andThen(emit(event), recorder.event(event)),
              { discard: true }
            );
          })
      ).pipe(
        Effect.catch((error) =>
          Ref.update(
            failure,
            (current) => current ?? failureFromText(error.message)
          )
        ),
        Effect.onExit(() => gate.abandon(turnId))
      );

      return {
        context: yield* Ref.get(context),
        failure: yield* Ref.get(failure),
        sessionId: yield* Ref.get(sessionId),
      };
    }),

  "history.blocks": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.blocks(params.sessionId)
    ).pipe(Effect.mapError(unstored)),

  "history.mode": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.setMode(params.sessionId, params.mode)
    ).pipe(Effect.mapError(unstored)),

  "history.remove": ({ params }) =>
    Effect.flatMap(HistoryStore, (store) =>
      store.remove(params.sessionId)
    ).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "history.sessions": () =>
    Effect.flatMap(HistoryStore, (store) => store.sessions).pipe(
      Effect.mapError(unstored)
    ),

  "preview.start": ({ emit, log, params }) =>
    Effect.flatMap(located(params.projectId), (project) =>
      Stream.runForEach(previewEvents(project.path, log), emit).pipe(
        Effect.as({ reason: "the preview host stopped" }),
        Effect.mapError((error) => new HandlerError({ message: error.message }))
      )
    ),

  "project.create": ({ params }) =>
    Effect.gen(function* () {
      const projects = yield* ProjectStore;
      const path = join(params.parent, params.name);

      yield* Effect.tryPromise({
        catch: (cause) => new HandlerError({ message: errorMessage(cause) }),
        try: () => mkdir(path, { recursive: true }),
      });

      return yield* Effect.mapError(projects.open(path), unstored);
    }),

  "project.list": () =>
    Effect.flatMap(ProjectStore, (projects) => projects.list).pipe(
      Effect.mapError(unstored)
    ),

  "project.open": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) => projects.open(params.path)).pipe(
      Effect.mapError(unstored)
    ),

  "project.relocate": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.relocate(params.projectId, params.path)
    ).pipe(Effect.mapError(unstored)),

  "project.remove": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.remove(params.projectId)
    ).pipe(
      Effect.map((removed) => ({ removed })),
      Effect.mapError(unstored)
    ),

  "project.rename": ({ params }) =>
    Effect.flatMap(ProjectStore, (projects) =>
      projects.rename(params.projectId, params.name)
    ).pipe(Effect.mapError(unstored)),

  "project.scaffold": ({ emit, log, params }) =>
    Effect.gen(function* () {
      const project = yield* located(params.projectId);

      yield* emit({ step: "template", type: "started" });
      yield* Effect.mapError(expandTemplate(project.path), unscaffolded);
      yield* emit({ step: "template", type: "done" });

      yield* emit({ step: "install", type: "started" });
      yield* Effect.mapError(
        installDependencies(project.path, log),
        unscaffolded
      );
      yield* emit({ step: "install", type: "done" });

      return project;
    }),

  "sidecar.emit": ({ emit, params }) =>
    Effect.gen(function* () {
      const total = clamp(params.count, 1, MAX_COUNT);
      const delayMs = clamp(params.delayMs, 0, MAX_DELAY_MS);
      const startedAt = yield* Clock.currentTimeMillis;

      yield* Effect.forEach(
        Array.from({ length: total }, (_unused, index) => index),
        (index) =>
          Effect.sleep(delayMs).pipe(
            Effect.andThen(
              emit({ index, token: TOKENS[index % TOKENS.length], total })
            )
          ),
        { discard: true }
      );

      const finishedAt = yield* Clock.currentTimeMillis;

      return { elapsedMs: finishedAt - startedAt, emitted: total };
    }),

  "sidecar.info": () =>
    Effect.sync(() => ({
      bun: (process.versions as Record<string, string | undefined>).bun ?? "",
      cwd: process.cwd(),
      pid: process.pid,
      protocol: SIDECAR_PROTOCOL,
      uptimeMs: Math.round(process.uptime() * 1000),
    })),
};

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(Math.trunc(value), low), high);
}
