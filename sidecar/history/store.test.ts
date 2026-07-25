// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { TranscriptEntry } from "@/shared/ipc";
import type { SqlDriver, SqlRow, SqlValue } from "@/sidecar/history/driver";
import { MIGRATIONS, migrate, prepare } from "@/sidecar/history/migrations";
import { broken, type HistoryStore, make } from "@/sidecar/history/store";

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

function store(): HistoryStore {
  const driver = nodeDriver();
  prepare(driver);
  migrate(driver);
  return make(driver);
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

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
});

describe("HistoryStore", () => {
  it("opens a session and lists it", async () => {
    const history = store();

    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );

    expect(session.folder).toBe("/videos/promo");
    expect(session.title).toBe("A promo");
    expect(session.sdkSessionId).toBeNull();
    expect(await run(history.sessions)).toEqual([session]);
  });

  it("keeps the first title when the same session is opened again", async () => {
    const history = store();

    const first = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );
    const again = await run(
      history.open({
        folder: "/videos/promo",
        id: first.id,
        title: "something else entirely",
      })
    );

    expect(again.id).toBe(first.id);
    expect(again.title).toBe("A promo");
    expect(again.createdAt).toBe(first.createdAt);
    expect(await run(history.sessions)).toHaveLength(1);
  });

  it("remembers the SDK session id so a later turn can resume it", async () => {
    const history = store();
    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );

    await run(history.bind(session.id, "sdk-42"));

    const [stored] = await run(history.sessions);
    expect(stored.sdkSessionId).toBe("sdk-42");
  });

  it("reads blocks back in order, with ids from their ordinal", async () => {
    const history = store();
    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );

    await run(
      history.write({
        entry: {
          attachments: [],
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
          input: { file_path: "/videos/promo/src/Main.tsx" },
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
        id: "block-0",
        kind: "user",
        text: "make a title card",
      },
      {
        id: "block-1",
        input: { file_path: "/videos/promo/src/Main.tsx" },
        kind: "activity",
        name: "Write",
        result: null,
        state: "running",
      },
    ]);
  });

  it("overwrites a block written again at the same ordinal", async () => {
    const history = store();
    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );

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
    const history = store();
    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );

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
    const history = store();
    const session = await run(
      history.open({ folder: "/videos/promo", id: null, title: "A promo" })
    );
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
    const history = store();

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
});

describe("broken", () => {
  it("answers every call with the reason it could not open", async () => {
    const exit = await Effect.runPromiseExit(broken("no disk").sessions);

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
