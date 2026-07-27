import { describe, expect, it } from "vitest";
import { paneGroups, sessionMeta } from "@/lib/studio/groups";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import type { HistorySession, Project } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const MINUTE = 60_000;

const project = (id: string): Project => ({
  createdAt: 0,
  id,
  missing: false,
  name: id,
  path: `/videos/${id}`,
  updatedAt: 0,
});

const session = (id: string, projectId: string): HistorySession => ({
  createdAt: 0,
  id,
  mode: "auto",
  projectId,
  sdkSessionId: null,
  title: id,
  updatedAt: 0,
});

const running = (startedAt = NOW - MINUTE): TurnState => ({
  ...IDLE_TURN,
  isRunning: true,
  startedAt,
});

const waiting = (askedAt: number, tool = "Bash"): TurnState => ({
  ...running(),
  permissions: [
    {
      askedAt,
      id: `ask-${askedAt}`,
      input: {},
      name: tool,
      reason: "bash",
    },
  ],
});

const failed = (error: string): TurnState => ({ ...IDLE_TURN, error });

const unread = (): TurnState => ({ ...IDLE_TURN, unread: true });

const ids = (rows: readonly { session: HistorySession }[]) =>
  rows.map((row) => row.session.id);

describe("paneGroups", () => {
  it("orders exactly as the store gave it when no turn is live", () => {
    const groups = paneGroups(
      [project("promo"), project("teaser")],
      [
        session("newest", "teaser"),
        session("older", "promo"),
        session("oldest", "promo"),
      ],
      new Map()
    );

    expect(groups.map((group) => group.project.id)).toEqual([
      "promo",
      "teaser",
    ]);
    expect(ids(groups[0].rows)).toEqual(["older", "oldest"]);
    expect(ids(groups[1].rows)).toEqual(["newest"]);
    expect(groups[0].rollup).toBeNull();
  });

  it("gives a project with no sessions an empty group", () => {
    const groups = paneGroups([project("promo")], [], new Map());

    expect(groups[0].rows).toEqual([]);
    expect(groups[0].rollup).toBeNull();
  });

  it("drops a session whose project is not listed", () => {
    const groups = paneGroups(
      [project("promo")],
      [session("stray", "removed")],
      new Map()
    );

    expect(groups[0].rows).toEqual([]);
  });

  it("floats a waiting session to the top and leads with the longest wait", () => {
    const groups = paneGroups(
      [project("promo")],
      [
        session("newest", "promo"),
        session("asked-late", "promo"),
        session("asked-early", "promo"),
      ],
      new Map([
        ["asked-late", waiting(NOW - 2 * MINUTE)],
        ["asked-early", waiting(NOW - 9 * MINUTE)],
      ])
    );

    expect(ids(groups[0].rows)).toEqual([
      "asked-early",
      "asked-late",
      "newest",
    ]);
  });

  it("keeps running sessions above settled ones, newest first", () => {
    const groups = paneGroups(
      [project("promo")],
      [
        session("settled", "promo"),
        session("newer-run", "promo"),
        session("older-run", "promo"),
      ],
      new Map([
        ["newer-run", running()],
        ["older-run", running()],
      ])
    );

    expect(ids(groups[0].rows)).toEqual(["newer-run", "older-run", "settled"]);
  });

  it("lifts a project with a waiting session above the rest, leaving the others alone", () => {
    const groups = paneGroups(
      [project("promo"), project("teaser"), project("trailer")],
      [
        session("quiet", "promo"),
        session("asking", "teaser"),
        session("busy", "trailer"),
      ],
      new Map([
        ["asking", waiting(NOW - MINUTE)],
        ["busy", running()],
      ])
    );

    expect(groups.map((group) => group.project.id)).toEqual([
      "teaser",
      "promo",
      "trailer",
    ]);
  });

  it("rolls up the worst state inside a collapsed group, and counts the waiting", () => {
    const groups = paneGroups(
      [project("promo")],
      [
        session("asking", "promo"),
        session("also-asking", "promo"),
        session("busy", "promo"),
        session("broken", "promo"),
        session("news", "promo"),
      ],
      new Map([
        ["also-asking", waiting(NOW - MINUTE)],
        ["asking", waiting(NOW - 2 * MINUTE)],
        ["broken", failed("bun install exited with code 1")],
        ["busy", running()],
        ["news", unread()],
      ])
    );

    expect(groups[0].rollup).toEqual({ count: 2, status: "waiting" });
  });

  it("prefers running, then failed, then unread when nothing is waiting", () => {
    const rollupOf = (turns: ReadonlyMap<string, TurnState>) =>
      paneGroups(
        [project("promo")],
        [session("a", "promo"), session("b", "promo")],
        turns
      )[0].rollup;

    expect(
      rollupOf(
        new Map([
          ["a", running()],
          ["b", failed("boom")],
        ])
      )
    ).toEqual({ count: 1, status: "running" });
    expect(
      rollupOf(
        new Map([
          ["a", failed("boom")],
          ["b", unread()],
        ])
      )
    ).toEqual({
      count: 1,
      status: "failed",
    });
    expect(rollupOf(new Map([["b", unread()]]))).toEqual({
      count: 1,
      status: "unread",
    });
  });

  it("hides only quiet rows behind the cap, and counts what it hid", () => {
    const rows = Array.from({ length: 6 }, (_unused, index) =>
      session(`quiet-${index}`, "promo")
    );

    const groups = paneGroups(
      [project("promo")],
      [session("asking", "promo"), ...rows, session("news", "promo")],
      new Map([
        ["asking", waiting(NOW - MINUTE)],
        ["news", unread()],
      ]),
      2
    );

    expect(ids(groups[0].visible)).toEqual([
      "asking",
      "quiet-0",
      "quiet-1",
      "news",
    ]);
    expect(groups[0].hidden).toBe(4);
    expect(groups[0].rows).toHaveLength(8);
  });
});

describe("sessionMeta", () => {
  const rowOf = (id: string, turn: TurnState) =>
    paneGroups(
      [project("promo")],
      [session(id, "promo")],
      new Map([[id, turn]])
    )[0].rows[0];

  it("says how long a session has been waiting, and on which tool", () => {
    const meta = sessionMeta(rowOf("a", waiting(NOW - 4 * MINUTE)), NOW);

    expect(meta).toEqual({ isError: false, text: "Waiting 4m · Bash" });
  });

  it("says how long a turn has been running", () => {
    const meta = sessionMeta(rowOf("a", running(NOW - 2 * MINUTE)), NOW);

    expect(meta).toEqual({ isError: false, text: "Running · 2m" });
  });

  it("shows the first line of an error and nothing after it", () => {
    const meta = sessionMeta(
      rowOf("a", failed("the sidecar is not running\n  at frame()")),
      NOW
    );

    expect(meta).toEqual({ isError: true, text: "the sidecar is not running" });
  });

  it("leaves a settled session without a second line", () => {
    expect(sessionMeta(rowOf("a", IDLE_TURN), NOW)).toBeNull();
    expect(sessionMeta(rowOf("a", unread()), NOW)).toBeNull();
  });
});
