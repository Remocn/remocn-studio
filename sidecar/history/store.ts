import { Clock, Context, Data, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  HistorySession,
  type SessionMode,
  TranscriptEntry,
} from "@/shared/ipc";
import {
  orderedStages,
  PipelineStage,
  type PipelineStageId,
  type PipelineStatus,
  startedStages,
} from "@/shared/pipeline";
import type { AgentProvider } from "@/shared/providers";
import type { SqlDriver, SqlRow } from "./driver";

export class HistoryError extends Data.TaggedError("HistoryError")<{
  message: string;
}> {}

export interface OpenSession {
  readonly id: string;
  readonly mode: SessionMode;
  readonly projectId: string;
  readonly provider: AgentProvider;
  readonly title: string;
}

export interface StoredBlock {
  readonly entry: TranscriptEntry;
  readonly ordinal: number;
  readonly sessionId: string;
}

export interface HistoryStore {
  readonly bind: (
    sessionId: string,
    sdkSessionId: string
  ) => Effect.Effect<void, HistoryError>;
  readonly blocks: (
    sessionId: string
  ) => Effect.Effect<readonly TranscriptEntry[], HistoryError>;
  readonly nextOrdinal: (
    sessionId: string
  ) => Effect.Effect<number, HistoryError>;
  readonly open: (
    input: OpenSession
  ) => Effect.Effect<HistorySession, HistoryError>;
  readonly pipeline: (
    sessionId: string
  ) => Effect.Effect<readonly PipelineStage[], HistoryError>;
  readonly remove: (sessionId: string) => Effect.Effect<boolean, HistoryError>;
  readonly sessions: Effect.Effect<readonly HistorySession[], HistoryError>;
  readonly setMode: (
    sessionId: string,
    mode: SessionMode
  ) => Effect.Effect<HistorySession, HistoryError>;
  readonly setStage: (
    sessionId: string,
    stage: PipelineStageId,
    status: PipelineStatus
  ) => Effect.Effect<readonly PipelineStage[], HistoryError>;
  readonly startPipeline: (
    sessionId: string
  ) => Effect.Effect<readonly PipelineStage[], HistoryError>;
  readonly write: (block: StoredBlock) => Effect.Effect<void, HistoryError>;
}

export const HistoryStore = Context.Service<HistoryStore>(
  "sidecar/HistoryStore"
);

const COLUMNS =
  "id, project_id, sdk_session_id, title, mode, provider, created_at, updated_at" as const;

const decodeSession = Schema.decodeUnknownEffect(HistorySession);
const decodeEntry = Schema.decodeUnknownEffect(TranscriptEntry);
const decodeStage = Schema.decodeUnknownEffect(PipelineStage);

const failed = (cause: unknown) =>
  new HistoryError({ message: errorMessage(cause) });

function attempt<A>(thunk: () => A): Effect.Effect<A, HistoryError> {
  return Effect.try({ catch: failed, try: thunk });
}

export function make(driver: SqlDriver): HistoryStore {
  const read = (sessionId: string) =>
    attempt(() =>
      driver.all(`SELECT ${COLUMNS} FROM session WHERE id = ?`, [sessionId])
    ).pipe(
      Effect.flatMap((rows) => {
        const row = rows.at(0);
        return row === undefined
          ? Effect.fail(
              new HistoryError({
                message: `there is no session called ${sessionId}`,
              })
            )
          : sessionOf(row);
      })
    );

  const stagesOf = (sessionId: string) =>
    attempt(() =>
      driver.all(
        "SELECT stage, status FROM pipeline_stage WHERE session_id = ?",
        [sessionId]
      )
    ).pipe(
      Effect.flatMap((rows) =>
        Effect.forEach(rows, (row) =>
          decodeStage({ stage: row.stage, status: row.status }).pipe(
            Effect.mapError(failed)
          )
        )
      ),
      Effect.map(orderedStages)
    );

  return {
    bind: (sessionId, sdkSessionId) =>
      attempt(() =>
        driver.run("UPDATE session SET sdk_session_id = ? WHERE id = ?", [
          sdkSessionId,
          sessionId,
        ])
      ).pipe(Effect.asVoid),

    blocks: (sessionId) =>
      attempt(() =>
        driver.all(
          "SELECT ordinal, kind, payload FROM block WHERE session_id = ? ORDER BY ordinal",
          [sessionId]
        )
      ).pipe(Effect.flatMap((rows) => Effect.forEach(rows, entryOf))),

    nextOrdinal: (sessionId) =>
      attempt(
        () =>
          driver.all(
            "SELECT COALESCE(MAX(ordinal), -1) + 1 AS next FROM block WHERE session_id = ?",
            [sessionId]
          )[0]?.next
      ).pipe(Effect.map((next) => (typeof next === "number" ? next : 0))),

    open: (input) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        yield* attempt(() =>
          driver.run(
            `INSERT INTO session (${COLUMNS}) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               project_id = excluded.project_id,
               mode = excluded.mode,
               provider = excluded.provider,
               updated_at = excluded.updated_at`,
            [
              input.id,
              input.projectId,
              input.title,
              input.mode,
              input.provider,
              now,
              now,
            ]
          )
        );

        return yield* read(input.id);
      }),

    pipeline: stagesOf,

    remove: (sessionId) =>
      attempt(() =>
        driver.run("DELETE FROM session WHERE id = ?", [sessionId])
      ).pipe(Effect.map((changes) => changes > 0)),

    sessions: attempt(() =>
      driver.all(
        `SELECT ${COLUMNS} FROM session ORDER BY updated_at DESC, created_at DESC`
      )
    ).pipe(Effect.flatMap((rows) => Effect.forEach(rows, sessionOf))),

    setMode: (sessionId, mode) =>
      attempt(() =>
        driver.run("UPDATE session SET mode = ? WHERE id = ?", [
          mode,
          sessionId,
        ])
      ).pipe(Effect.andThen(read(sessionId))),

    setStage: (sessionId, stage, status) =>
      attempt(() =>
        driver.run(
          "UPDATE pipeline_stage SET status = ? WHERE session_id = ? AND stage = ?",
          [status, sessionId, stage]
        )
      ).pipe(
        Effect.flatMap((changes) =>
          changes > 0
            ? stagesOf(sessionId)
            : Effect.fail(
                new HistoryError({
                  message: `session ${sessionId} has no pipeline stage called ${stage}`,
                })
              )
        )
      ),

    startPipeline: (sessionId) =>
      Effect.forEach(startedStages(), (row) =>
        attempt(() =>
          driver.run(
            `INSERT INTO pipeline_stage (session_id, stage, status)
             VALUES (?, ?, ?)
             ON CONFLICT (session_id, stage) DO NOTHING`,
            [sessionId, row.stage, row.status]
          )
        )
      ).pipe(Effect.andThen(stagesOf(sessionId))),

    write: (block) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        yield* attempt(() =>
          driver.run(
            `INSERT INTO block (session_id, ordinal, kind, payload, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (session_id, ordinal) DO UPDATE SET
               kind = excluded.kind,
               payload = excluded.payload`,
            [
              block.sessionId,
              block.ordinal,
              block.entry.kind,
              payloadOf(block.entry),
              now,
            ]
          )
        );
      }),
  };
}

export function broken(message: string): HistoryStore {
  const fail = Effect.fail(new HistoryError({ message }));

  return {
    bind: () => fail,
    blocks: () => fail,
    nextOrdinal: () => fail,
    open: () => fail,
    pipeline: () => fail,
    remove: () => fail,
    sessions: fail,
    setMode: () => fail,
    setStage: () => fail,
    startPipeline: () => fail,
    write: () => fail,
  };
}

function sessionOf(row: SqlRow): Effect.Effect<HistorySession, HistoryError> {
  return decodeSession({
    createdAt: row.created_at,
    id: row.id,
    mode: row.mode,
    projectId: row.project_id,
    provider: row.provider,
    sdkSessionId: row.sdk_session_id,
    title: row.title,
    updatedAt: row.updated_at,
  }).pipe(Effect.mapError(failed));
}

function entryOf(row: SqlRow): Effect.Effect<TranscriptEntry, HistoryError> {
  return attempt(
    () => JSON.parse(String(row.payload)) as Record<string, unknown>
  ).pipe(
    Effect.flatMap((payload) =>
      decodeEntry({
        ...payload,
        id: `block-${row.ordinal}`,
        kind: row.kind,
      }).pipe(Effect.mapError(failed))
    )
  );
}

function payloadOf(entry: TranscriptEntry): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== "id" && key !== "kind")
    )
  );
}
