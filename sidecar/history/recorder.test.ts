// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { ClaudeEvent, PromptParams, TranscriptEntry } from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";
import type { SqlDriver, SqlRow, SqlValue } from "@/sidecar/history/driver";
import { migrate, prepare } from "@/sidecar/history/migrations";
import { recording } from "@/sidecar/history/recorder";
import { broken, type HistoryStore, make } from "@/sidecar/history/store";

const PROJECT_ID = "project-1";

function store(): HistoryStore {
  const db = new DatabaseSync(":memory:");
  const driver: SqlDriver = {
    all: (sql, values = []) =>
      db.prepare(sql).all(...(values as SqlValue[])) as SqlRow[],
    close: () => db.close(),
    exec: (sql) => db.exec(sql),
    run: (sql, values = []) =>
      Number(db.prepare(sql).run(...(values as SqlValue[])).changes),
  };

  prepare(driver);
  migrate(driver);
  driver.run(
    `INSERT INTO project (id, path, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [PROJECT_ID, "/videos/promo", "promo", 0, 0]
  );
  return make(driver);
}

function params(shape: Partial<PromptParams>): PromptParams {
  return {
    attachments: [],
    effort: null,
    historyId: crypto.randomUUID(),
    model: null,
    projectId: PROJECT_ID,
    prompt: "make a title card",
    sessionId: null,
    ...shape,
  };
}

const TURN: ClaudeEvent[] = [
  { model: "claude-opus-5", sessionId: "sdk-7", type: "session" },
  { text: "Writing ", type: "text" },
  { text: "the scene.", type: "text" },
  {
    id: "toolu_1",
    input: { file_path: "/videos/promo/src/Main.tsx" },
    name: "Write",
    type: "tool_use",
  },
  { id: "toolu_1", isError: false, text: "written", type: "tool_result" },
  { text: "Done.", type: "text" },
];

function bare(entry: TranscriptEntry) {
  return Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== "id")
  );
}

function live(input: PromptParams, events: readonly ClaudeEvent[]) {
  return events
    .reduce(
      fold,
      appendUser([], { attachments: input.attachments, text: input.prompt })
    )
    .map(bare);
}

const logged: string[] = [];
const log = (line: string) => Effect.sync(() => logged.push(line));

describe("recording", () => {
  it("stores exactly what the live transcript folds to", async () => {
    const history = store();
    const input = params({});

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* Effect.forEach(TURN, recorder.event, { discard: true });
        return recorder.session;
      })
    );

    expect(session).not.toBeNull();

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual(live(input, TURN));
  });

  it("leaves a readable prefix when the turn stops halfway", async () => {
    const history = store();
    const input = params({});
    const half = TURN.slice(0, 4);

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* Effect.forEach(half, recorder.event, { discard: true });
        return recorder.session;
      })
    );

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual(live(input, half));
    expect(stored.at(-1)).toMatchObject({ name: "Write", state: "running" });
  });

  it("appends a second turn after the first instead of overwriting it", async () => {
    const history = store();
    const first = params({ historyId: "history-1" });

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, first, log);
        yield* Effect.forEach(TURN, recorder.event, { discard: true });
        return recorder.session;
      })
    );

    const second = params({ historyId: "history-1", prompt: "now in red" });
    await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, second, log);
        yield* recorder.event({ text: "Recolouring.", type: "text" });
      })
    );

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual([
      ...live(first, TURN),
      ...live(second, [{ text: "Recolouring.", type: "text" }]),
    ]);
  });

  it("titles the session from the first message and keeps it", async () => {
    const history = store();
    const long = "a".repeat(200);

    const opened = await Effect.runPromise(
      recording(
        history,
        params({ historyId: "history-1", prompt: `  ${long}  ` }),
        log
      )
    );
    expect(opened.session?.title).toHaveLength(60);

    const again = await Effect.runPromise(
      recording(
        history,
        params({ historyId: "history-1", prompt: "a follow-up" }),
        log
      )
    );
    expect(again.session?.title).toBe(opened.session?.title);
  });

  it("names an image-only turn after its attachment", async () => {
    const history = store();

    const opened = await Effect.runPromise(
      recording(
        history,
        params({
          attachments: [
            {
              mediaType: "image/png",
              name: "board.png",
              path: "/tmp/board.png",
            },
          ],
          prompt: "",
        }),
        log
      )
    );

    expect(opened.session?.title).toBe("board.png");
  });

  it("binds the SDK session id so the next turn resumes it", async () => {
    const history = store();

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, params({}), log);
        yield* recorder.event(TURN[0]);
        return recorder.session;
      })
    );

    const [stored] = await Effect.runPromise(history.sessions);
    expect(stored.id).toBe(session?.id);
    expect(stored.sdkSessionId).toBe("sdk-7");
  });

  it("lets the turn run on when the database is unusable", async () => {
    const recorder = await Effect.runPromise(
      recording(broken("no disk"), params({}), log)
    );

    expect(recorder.session).toBeNull();
    await Effect.runPromise(
      recorder.event({ text: "still fine", type: "text" })
    );
    expect(logged).toContain("history: no disk");
  });
});
