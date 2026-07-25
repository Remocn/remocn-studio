// @vitest-environment node
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { SqlDriver, SqlRow, SqlValue } from "@/sidecar/history/driver";
import { MIGRATIONS, migrate, prepare } from "@/sidecar/history/migrations";
import { make, type ProjectStore } from "@/sidecar/history/projects";
import { make as makeHistory } from "@/sidecar/history/store";

function nodeDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");

  return {
    all: (sql, params = []) =>
      db.prepare(sql).all(...(params as SqlValue[])) as SqlRow[],
    close: () => db.close(),
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) =>
      Number(db.prepare(sql).run(...(params as SqlValue[])).changes),
  };
}

function store(): ProjectStore {
  const driver = nodeDriver();
  prepare(driver);
  migrate(driver);
  return make(driver);
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const temporary = () => mkdtemp(join(tmpdir(), "remocn-project-"));

describe("ProjectStore", () => {
  it("names a project after its folder and finds it again", async () => {
    const projects = store();

    const opened = await run(projects.open("/videos/promo"));

    expect(opened.name).toBe("promo");
    expect(opened.path).toBe("/videos/promo");
    expect(await run(projects.find(opened.id))).toEqual(opened);
    expect(await run(projects.list)).toEqual([opened]);
  });

  it("lands on the same row when the folder is opened again", async () => {
    const projects = store();

    const first = await run(projects.open("/videos/promo"));
    const again = await run(projects.open("/videos/../videos/promo/"));

    expect(again.id).toBe(first.id);
    expect(await run(projects.list)).toHaveLength(1);
  });

  it("resolves a symlink to the folder it points at", async () => {
    const projects = store();
    const real = await temporary();
    const link = join(await temporary(), "link");
    await symlink(real, link);

    const direct = await run(projects.open(real));
    const followed = await run(projects.open(link));

    expect(followed.id).toBe(direct.id);
    expect(await run(projects.list)).toHaveLength(1);
  });

  it("keeps the row of a folder that is gone and says it is missing", async () => {
    const projects = store();
    const folder = await temporary();

    const opened = await run(projects.open(folder));
    expect(opened.missing).toBe(false);

    await rm(folder, { recursive: true });

    const [listed] = await run(projects.list);
    expect(listed.id).toBe(opened.id);
    expect(listed.missing).toBe(true);
  });

  it("renames a project without touching its path", async () => {
    const projects = store();
    const opened = await run(projects.open("/videos/promo"));

    const renamed = await run(projects.rename(opened.id, "Launch film"));

    expect(renamed.name).toBe("Launch film");
    expect(renamed.path).toBe(opened.path);
  });

  it("fails rather than inventing a project that was never opened", async () => {
    const projects = store();

    const exit = await Effect.runPromiseExit(projects.find("nope"));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("orders projects by their most recent session", async () => {
    const driver = nodeDriver();
    prepare(driver);
    migrate(driver);
    const projects = make(driver);
    const history = makeHistory(driver);

    const first = await run(projects.open("/videos/first"));
    const second = await run(projects.open("/videos/second"));
    await run(
      history.open({ id: "s-1", projectId: first.id, title: "A promo" })
    );

    expect((await run(projects.list)).map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("takes the sessions and their blocks with it when removed", async () => {
    const driver = nodeDriver();
    prepare(driver);
    migrate(driver);
    const projects = make(driver);
    const history = makeHistory(driver);

    const project = await run(projects.open("/videos/promo"));
    const session = await run(
      history.open({ id: "s-1", projectId: project.id, title: "A promo" })
    );
    await run(
      history.write({
        entry: { id: "a-1", kind: "assistant", text: "hi" },
        ordinal: 0,
        sessionId: session.id,
      })
    );

    expect(await run(projects.remove(project.id))).toBe(true);
    expect(await run(projects.remove(project.id))).toBe(false);
    expect(await run(history.sessions)).toEqual([]);
    expect(driver.all("SELECT session_id FROM block")).toEqual([]);
  });
});

describe("the migration to projects", () => {
  function version1(): SqlDriver {
    const driver = nodeDriver();
    prepare(driver);

    for (const statement of MIGRATIONS[0]) {
      if (typeof statement === "string") {
        driver.exec(statement);
      }
    }
    driver.exec("PRAGMA user_version = 1");

    return driver;
  }

  function session(driver: SqlDriver, id: string, folder: string, at: number) {
    driver.run(
      `INSERT INTO session (id, sdk_session_id, folder, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, `sdk-${id}`, folder, `Session ${id}`, at, at]
    );
    driver.run(
      `INSERT INTO block (session_id, ordinal, kind, payload, created_at)
       VALUES (?, 0, 'assistant', ?, ?)`,
      [id, JSON.stringify({ text: `block of ${id}` }), at]
    );
  }

  it("puts every old session under a project named after its folder", async () => {
    const driver = version1();
    session(driver, "one", "/videos/promo", 10);
    session(driver, "two", "/videos/promo", 20);
    session(driver, "three", "/videos/teaser", 30);

    migrate(driver);

    const projects = make(driver);
    const history = makeHistory(driver);

    const rows = await run(projects.list);
    expect(rows.map((row) => row.name).sort()).toEqual(["promo", "teaser"]);

    const promo = rows.find((row) => row.path === "/videos/promo");
    expect(promo?.createdAt).toBe(10);
    expect(promo?.updatedAt).toBe(20);

    const sessions = await run(history.sessions);
    expect(sessions).toHaveLength(3);
    expect(
      sessions
        .filter((row) => row.projectId === promo?.id)
        .map((row) => row.id)
        .sort()
    ).toEqual(["one", "two"]);
    expect(sessions.find((row) => row.id === "one")?.sdkSessionId).toBe(
      "sdk-one"
    );

    expect(await run(history.blocks("one"))).toEqual([
      { id: "block-0", kind: "assistant", text: "block of one" },
    ]);
  });

  it("leaves the transcripts alone while it rebuilds the table", () => {
    const driver = version1();
    session(driver, "one", "/videos/promo", 10);

    migrate(driver);

    expect(driver.all("SELECT COUNT(*) AS rows FROM block").at(0)).toEqual({
      rows: 1,
    });
  });
});
