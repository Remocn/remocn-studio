import { Clock, Context, Data, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { HistorySession, TranscriptEntry } from "@/shared/ipc";
import type { SqlDriver, SqlRow } from "./driver";

export class HistoryError extends Data.TaggedError("HistoryError")<{
  message: string;
}> {}

export interface OpenSession {
  readonly id: string;
  readonly projectId: string;
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
  readonly remove: (sessionId: string) => Effect.Effect<boolean, HistoryError>;
  readonly sessions: Effect.Effect<readonly HistorySession[], HistoryError>;
  readonly write: (block: StoredBlock) => Effect.Effect<void, HistoryError>;
}

export const HistoryStore = Context.Service<HistoryStore>(
  "sidecar/HistoryStore"
);

const COLUMNS =
  "id, project_id, sdk_session_id, title, created_at, updated_at" as const;

const decodeSession = Schema.decodeUnknownEffect(HistorySession);
const decodeEntry = Schema.decodeUnknownEffect(TranscriptEntry);

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
            `INSERT INTO session (${COLUMNS}) VALUES (?, ?, NULL, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               project_id = excluded.project_id,
               updated_at = excluded.updated_at`,
            [input.id, input.projectId, input.title, now, now]
          )
        );

        return yield* read(input.id);
      }),

    remove: (sessionId) =>
      attempt(() =>
        driver.run("DELETE FROM session WHERE id = ?", [sessionId])
      ).pipe(Effect.map((changes) => changes > 0)),

    sessions: attempt(() =>
      driver.all(
        `SELECT ${COLUMNS} FROM session ORDER BY updated_at DESC, created_at DESC`
      )
    ).pipe(Effect.flatMap((rows) => Effect.forEach(rows, sessionOf))),

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
    remove: () => fail,
    sessions: fail,
    write: () => fail,
  };
}

function sessionOf(row: SqlRow): Effect.Effect<HistorySession, HistoryError> {
  return decodeSession({
    createdAt: row.created_at,
    id: row.id,
    projectId: row.project_id,
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
