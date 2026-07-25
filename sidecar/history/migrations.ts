import type { SqlDriver } from "./driver";

export const MIGRATIONS: readonly (readonly string[])[] = [
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

  driver.exec("BEGIN");
  try {
    for (const step of MIGRATIONS.slice(from)) {
      for (const statement of step) {
        driver.exec(statement);
      }
    }
    driver.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    driver.exec("COMMIT");
  } catch (cause) {
    driver.exec("ROLLBACK");
    throw cause;
  }

  return MIGRATIONS.length;
}

function userVersion(driver: SqlDriver): number {
  const value = driver.all("PRAGMA user_version").at(0)?.user_version;
  return typeof value === "number" ? value : 0;
}
