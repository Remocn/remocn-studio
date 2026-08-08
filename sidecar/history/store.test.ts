// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { SessionMode, TranscriptEntry } from "@/shared/ipc";
import type { SqlDriver, SqlRow, SqlValue } from "@/sidecar/history/driver";
import { MIGRATIONS, migrate, prepare } from "@/sidecar/history/migrations";
import { make as makeProjects } from "@/sidecar/history/projects";
import { broken, make } from "@/sidecar/history/store";

const FOLDER = "/videos/promo";
const MODE = "auto" as const;

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

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function studio() {
  const driver = nodeDriver();
  prepare(driver);
  migrate(driver);

  const history = make(driver);
  const project = await run(makeProjects(driver).open(FOLDER));

  const open = (
    title: string,
    id = crypto.randomUUID(),
    mode: SessionMode = MODE
  ) => history.open({ id, mode, projectId: project.id, title });

  return { history, open, project };
}

const assistant = (text: string): TranscriptEntry => ({
  id: "assistant-1",
  kind: "assistant",
  text,
});

describe("migrate", () => {
  it("stamps the schema version and is safe to run twice", () => {
    const driver = nodeDriver();
    prepare(driver);

    expect(migrate(driver)).toBe(MIGRATIONS.length);
    expect(migrate(driver)).toBe(MIGRATIONS.length);
    expect(driver.all("PRAGMA user_version").at(0)).toEqual({
      user_version: MIGRATIONS.length,
    });
  });

  it("leaves a session that predates the mode column in Auto", async () => {
    const driver = nodeDriver();
    prepare(driver);

    driver.exec("PRAGMA foreign_keys = OFF");
    for (const step of MIGRATIONS.slice(0, 2).flat()) {
      if (typeof step === "string") {
        driver.exec(step);
      } else {
        step(driver);
      }
    }
    driver.exec("PRAGMA user_version = 2");
    driver.exec("PRAGMA foreign_keys = ON");

    driver.run(
      `INSERT INTO project (id, path, name, created_at, updated_at)
       VALUES ('p', ?, 'promo', 0, 0)`,
      [FOLDER]
    );
    driver.run(
      `INSERT INTO session (id, project_id, sdk_session_id, title, created_at, updated_at)
       VALUES ('s', 'p', NULL, 'A promo', 0, 0)`
    );

    migrate(driver);

    const [session] = await run(make(driver).sessions);
    expect(session.mode).toBe("auto");
    expect(session.title).toBe("A promo");
  });
});

describe("HistoryStore", () => {
  it("opens a session under its project and lists it", async () => {
    const { history, open, project } = await studio();

    const session = await run(open("A promo"));

    expect(session.projectId).toBe(project.id);
    expect(session.title).toBe("A promo");
    expect(session.sdkSessionId).toBeNull();
    expect(await run(history.sessions)).toEqual([session]);
  });

  it("keeps the first title when the same session is opened again", async () => {
    const { history, open } = await studio();

    const first = await run(open("A promo"));
    const again = await run(open("something else entirely", first.id));

    expect(again.id).toBe(first.id);
    expect(again.title).toBe("A promo");
    expect(again.createdAt).toBe(first.createdAt);
    expect(await run(history.sessions)).toHaveLength(1);
  });

  it("starts a session in the mode its first turn ran in", async () => {
    const { open } = await studio();

    const session = await run(open("A plan", crypto.randomUUID(), "plan"));

    expect(session.mode).toBe("plan");
  });

  it("takes the mode of the turn that opened it again", async () => {
    const { open } = await studio();

    const first = await run(open("A promo", crypto.randomUUID(), "plan"));
    const again = await run(open("A promo", first.id, "acceptEdits"));

    expect(again.mode).toBe("acceptEdits");
  });

  it("changes a mode between turns without touching the transcript", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));
    await run(
      history.write({
        entry: assistant("Building it."),
        ordinal: 0,
        sessionId: session.id,
      })
    );

    const changed = await run(history.setMode(session.id, "plan"));

    expect(changed.mode).toBe("plan");
    expect(changed.updatedAt).toBe(session.updatedAt);
    expect(await run(history.blocks(session.id))).toHaveLength(1);
  });

  it("refuses to change the mode of a session it never opened", async () => {
    const { history } = await studio();

    const exit = await Effect.runPromiseExit(history.setMode("nope", "plan"));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("remembers the SDK session id so a later turn can resume it", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));

    await run(history.bind(session.id, "sdk-42"));

    const [stored] = await run(history.sessions);
    expect(stored.sdkSessionId).toBe("sdk-42");
  });

  it("reads blocks back in order, with ids from their ordinal", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));

    await run(
      history.write({
        entry: {
          attachments: [],
          elements: [],
          id: "user-0",
          kind: "user",
          text: "make a title card",
        },
        ordinal: 0,
        sessionId: session.id,
      })
    );
    await run(
      history.write({
        entry: {
          id: "toolu_1",
          input: { file_path: `${FOLDER}/src/Main.tsx` },
          kind: "activity",
          name: "Write",
          result: null,
          state: "running",
        },
        ordinal: 1,
        sessionId: session.id,
      })
    );

    expect(await run(history.blocks(session.id))).toEqual([
      {
        attachments: [],
        elements: [],
        id: "block-0",
        kind: "user",
        text: "make a title card",
      },
      {
        id: "block-1",
        input: { file_path: `${FOLDER}/src/Main.tsx` },
        kind: "activity",
        name: "Write",
        result: null,
        state: "running",
      },
    ]);
  });

  it("overwrites a block written again at the same ordinal", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));

    await run(
      history.write({
        entry: assistant("Buil"),
        ordinal: 0,
        sessionId: session.id,
      })
    );
    await run(
      history.write({
        entry: assistant("Building it now."),
        ordinal: 0,
        sessionId: session.id,
      })
    );

    const blocks = await run(history.blocks(session.id));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ text: "Building it now." });
    expect(await run(history.nextOrdinal(session.id))).toBe(1);
  });

  it("continues numbering where the last turn stopped", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));

    expect(await run(history.nextOrdinal(session.id))).toBe(0);

    await run(
      history.write({
        entry: assistant("one"),
        ordinal: 0,
        sessionId: session.id,
      })
    );
    await run(
      history.write({
        entry: assistant("two"),
        ordinal: 1,
        sessionId: session.id,
      })
    );

    expect(await run(history.nextOrdinal(session.id))).toBe(2);
  });

  it("takes the blocks with the session when it is deleted", async () => {
    const { history, open } = await studio();
    const session = await run(open("A promo"));
    await run(
      history.write({
        entry: assistant("hi"),
        ordinal: 0,
        sessionId: session.id,
      })
    );

    expect(await run(history.remove(session.id))).toBe(true);
    expect(await run(history.remove(session.id))).toBe(false);
    expect(await run(history.sessions)).toEqual([]);
    expect(await run(history.blocks(session.id))).toEqual([]);
  });

  it("fails rather than inventing a session that was never opened", async () => {
    const { history } = await studio();

    const exit = await Effect.runPromiseExit(history.blocks("nope"));
    expect(Exit.isSuccess(exit)).toBe(true);

    const bound = await Effect.runPromiseExit(
      history.write({
        entry: assistant("orphan"),
        ordinal: 0,
        sessionId: "nope",
      })
    );
    expect(Exit.isFailure(bound)).toBe(true);
  });

  it("refuses a session whose project does not exist", async () => {
    const { history } = await studio();

    const exit = await Effect.runPromiseExit(
      history.open({
        id: "s-1",
        mode: MODE,
        projectId: "gone",
        title: "Orphan",
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("pipeline", () => {
  it("answers no stages for a session without one", async () => {
    const { history, open } = await studio();
    const session = await run(open("Plain chat"));

    expect(await run(history.pipeline(session.id))).toEqual([]);
  });

  it("starts with analysis active and the rest pending, in template order", async () => {
    const { history, open } = await studio();
    const session = await run(open("A video"));

    const stages = await run(history.startPipeline(session.id));

    expect(stages.map((row) => row.stage)).toEqual([
      "analysis",
      "brand",
      "script",
      "motion",
      "build",
      "review",
    ]);
    expect(stages[0]).toEqual({ stage: "analysis", status: "active" });
    expect(stages.slice(1).every((row) => row.status === "pending")).toBe(true);
  });

  it("keeps moved stages when started twice", async () => {
    const { history, open } = await studio();
    const session = await run(open("A video"));

    await run(history.startPipeline(session.id));
    await run(history.setStage(session.id, "analysis", "done"));
    const stages = await run(history.startPipeline(session.id));

    expect(stages[0]).toEqual({ stage: "analysis", status: "done" });
  });

  it("moves a stage and answers the whole pipeline", async () => {
    const { history, open } = await studio();
    const session = await run(open("A video"));
    await run(history.startPipeline(session.id));

    const stages = await run(history.setStage(session.id, "brand", "active"));

    expect(stages[1]).toEqual({ stage: "brand", status: "active" });
  });

  it("refuses to move a stage of a pipeline that was never started", async () => {
    const { history, open } = await studio();
    const session = await run(open("Plain chat"));

    const exit = await Effect.runPromiseExit(
      history.setStage(session.id, "brand", "done")
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("goes with its session when the session is removed", async () => {
    const { history, open } = await studio();
    const session = await run(open("A video"));
    await run(history.startPipeline(session.id));

    await run(history.remove(session.id));

    expect(await run(history.pipeline(session.id))).toEqual([]);
  });
});

describe("broken", () => {
  it("answers every call with the reason it could not open", async () => {
    const exit = await Effect.runPromiseExit(broken("no disk").sessions);

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
