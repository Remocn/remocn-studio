import { existsSync } from "node:fs";
import { Clock, Context, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { Project } from "@/shared/ipc";
import { canonicalPath, nameOf } from "../canonical";
import type { SqlDriver, SqlRow } from "./driver";
import { HistoryError } from "./store";

export interface ProjectStore {
  readonly find: (id: string) => Effect.Effect<Project, HistoryError>;
  readonly list: Effect.Effect<readonly Project[], HistoryError>;
  readonly open: (path: string) => Effect.Effect<Project, HistoryError>;
  readonly remove: (id: string) => Effect.Effect<boolean, HistoryError>;
  readonly rename: (
    id: string,
    name: string
  ) => Effect.Effect<Project, HistoryError>;
}

export const ProjectStore = Context.Service<ProjectStore>(
  "sidecar/ProjectStore"
);

const COLUMNS = "id, path, name, created_at, updated_at" as const;

const BY_LAST_SESSION = `SELECT ${COLUMNS} FROM project
   ORDER BY COALESCE(
     (SELECT MAX(updated_at) FROM session WHERE project_id = project.id),
     updated_at
   ) DESC` as const;

const decodeProject = Schema.decodeUnknownEffect(Project);

const failed = (cause: unknown) =>
  new HistoryError({ message: errorMessage(cause) });

function attempt<A>(thunk: () => A): Effect.Effect<A, HistoryError> {
  return Effect.try({ catch: failed, try: thunk });
}

export function make(driver: SqlDriver): ProjectStore {
  const read = (id: string) =>
    attempt(() =>
      driver.all(`SELECT ${COLUMNS} FROM project WHERE id = ?`, [id])
    ).pipe(Effect.flatMap((rows) => only(rows, `there is no project ${id}`)));

  return {
    find: read,

    list: attempt(() => driver.all(BY_LAST_SESSION)).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, projectOf))
    ),

    open: (path) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const canonical = canonicalPath(path);

        yield* attempt(() =>
          driver.run(
            `INSERT INTO project (${COLUMNS}) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (path) DO NOTHING`,
            [crypto.randomUUID(), canonical, nameOf(canonical), now, now]
          )
        );

        const rows = yield* attempt(() =>
          driver.all(`SELECT ${COLUMNS} FROM project WHERE path = ?`, [
            canonical,
          ])
        );

        return yield* only(rows, `${canonical} could not be opened`);
      }),

    remove: (id) =>
      attempt(() => driver.run("DELETE FROM project WHERE id = ?", [id])).pipe(
        Effect.map((changes) => changes > 0)
      ),

    rename: (id, name) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        yield* attempt(() =>
          driver.run(
            "UPDATE project SET name = ?, updated_at = ? WHERE id = ?",
            [name, now, id]
          )
        );

        return yield* read(id);
      }),
  };
}

export function broken(message: string): ProjectStore {
  const fail = Effect.fail(new HistoryError({ message }));

  return {
    find: () => fail,
    list: fail,
    open: () => fail,
    remove: () => fail,
    rename: () => fail,
  };
}

function only(
  rows: readonly SqlRow[],
  absent: string
): Effect.Effect<Project, HistoryError> {
  const row = rows.at(0);
  return row === undefined
    ? Effect.fail(new HistoryError({ message: absent }))
    : projectOf(row);
}

function projectOf(row: SqlRow): Effect.Effect<Project, HistoryError> {
  const path = String(row.path);

  return decodeProject({
    createdAt: row.created_at,
    id: row.id,
    missing: !existsSync(path),
    name: row.name,
    path,
    updatedAt: row.updated_at,
  }).pipe(Effect.mapError(failed));
}
