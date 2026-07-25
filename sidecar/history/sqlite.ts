import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { DATA_DIR_ENV } from "@/shared/ipc";
import type { SqlDriver, SqlRow, SqlValue } from "./driver";
import { migrate, prepare } from "./migrations";
import {
  broken as brokenProjects,
  make as makeProjects,
  type ProjectStore,
} from "./projects";
import { broken, type HistoryStore, make } from "./store";

const FILE = "history.db";

export interface Stores {
  readonly history: HistoryStore;
  readonly projects: ProjectStore;
}

export function driverFor(path: string): SqlDriver {
  const db = new Database(path, { create: true });

  return {
    all: (sql, params = []) => db.query(sql).all(...params) as SqlRow[],
    close: () => db.close(),
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) => db.run(sql, params as SqlValue[]).changes,
  };
}

export function openStores(
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<Stores> {
  return Effect.suspend(() => {
    const path = join(directory(), FILE);

    return Effect.try({
      catch: errorMessage,
      try: () => {
        const driver = driverFor(path);
        prepare(driver);
        return { driver, version: migrate(driver) };
      },
    }).pipe(
      Effect.tap(({ version }) =>
        log(`history at ${path}, schema version ${version}`)
      ),
      Effect.map(({ driver }) => ({
        history: make(driver),
        projects: makeProjects(driver),
      })),
      Effect.catch((message) =>
        log(`history is unavailable: ${message}`).pipe(
          Effect.as({
            history: broken(`the history at ${path} could not be opened`),
            projects: brokenProjects(
              `the history at ${path} could not be opened`
            ),
          })
        )
      )
    );
  });
}

function directory(): string {
  const dir = process.env[DATA_DIR_ENV] ?? join(tmpdir(), "remocn-studio");
  mkdirSync(dir, { recursive: true });
  return dir;
}
