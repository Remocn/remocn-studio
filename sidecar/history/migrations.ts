import { canonicalPath, nameOf } from "../canonical";
import type { SqlDriver } from "./driver";

export type Migration = string | ((driver: SqlDriver) => void);

export const MIGRATIONS: readonly (readonly Migration[])[] = [
  [
    `CREATE TABLE session (
      id TEXT PRIMARY KEY,
      sdk_session_id TEXT,
      folder TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    "CREATE INDEX session_by_recency ON session (updated_at DESC)",
    `CREATE TABLE block (
      session_id TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (session_id, ordinal)
    )`,
  ],
  [
    `CREATE TABLE project (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE session_next (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
      sdk_session_id TEXT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    regroup,
    "DROP TABLE session",
    "ALTER TABLE session_next RENAME TO session",
    "CREATE INDEX session_by_recency ON session (updated_at DESC)",
    "CREATE INDEX session_by_project ON session (project_id)",
  ],
];

export function prepare(driver: SqlDriver): void {
  driver.exec("PRAGMA journal_mode = WAL");
  driver.exec("PRAGMA synchronous = NORMAL");
  driver.exec("PRAGMA foreign_keys = ON");
}

export function migrate(driver: SqlDriver): number {
  const from = userVersion(driver);
  if (from >= MIGRATIONS.length) {
    return from;
  }

  driver.exec("PRAGMA foreign_keys = OFF");
  driver.exec("BEGIN");
  try {
    for (const step of MIGRATIONS.slice(from)) {
      for (const migration of step) {
        apply(driver, migration);
      }
    }
    orphans(driver);
    driver.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    driver.exec("COMMIT");
  } catch (cause) {
    driver.exec("ROLLBACK");
    throw cause;
  } finally {
    driver.exec("PRAGMA foreign_keys = ON");
  }

  return MIGRATIONS.length;
}

function apply(driver: SqlDriver, migration: Migration): void {
  if (typeof migration === "string") {
    driver.exec(migration);
    return;
  }
  migration(driver);
}

function regroup(driver: SqlDriver): void {
  const ids = new Map<string, string>();

  const folders = driver.all(
    `SELECT folder, MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
     FROM session GROUP BY folder`
  );

  for (const row of folders) {
    const folder = String(row.folder);
    const path = canonicalPath(folder);
    const createdAt = Number(row.created_at);
    const updatedAt = Number(row.updated_at);

    const known = ids.get(path);
    const id = known ?? crypto.randomUUID();

    if (known === undefined) {
      ids.set(path, id);
      driver.run(
        `INSERT INTO project (id, path, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, path, nameOf(path), createdAt, updatedAt]
      );
    } else {
      driver.run(
        `UPDATE project SET created_at = MIN(created_at, ?), updated_at = MAX(updated_at, ?)
         WHERE id = ?`,
        [createdAt, updatedAt, id]
      );
    }

    driver.run(
      `INSERT INTO session_next (id, project_id, sdk_session_id, title, created_at, updated_at)
       SELECT id, ?, sdk_session_id, title, created_at, updated_at FROM session WHERE folder = ?`,
      [id, folder]
    );
  }
}

function orphans(driver: SqlDriver): void {
  const broken = driver.all("PRAGMA foreign_key_check");
  if (broken.length > 0) {
    throw new Error(
      `the migration left ${broken.length} rows pointing at nothing`
    );
  }
}

function userVersion(driver: SqlDriver): number {
  const value = driver.all("PRAGMA user_version").at(0)?.user_version;
  return typeof value === "number" ? value : 0;
}
