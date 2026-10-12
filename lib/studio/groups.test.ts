import { describe, expect, it } from "bun:test";
import {
  newestChat,
  newestChatIn,
  paneGroups,
  paneSections,
  reuseGroups,
  sessionMeta,
} from "@/lib/studio/groups";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import type { HistorySession, TranscriptEntry, Video } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const MINUTE = 60_000;

const video = (id: string, missing = false): Video => ({
  compositionId: id,
  createdAt: 0,
  deletedAt: null,
  id,
  missing,
  name: id,
  projectId: "project-1",
  updatedAt: 0,
});

const session = (id: string, videoId: string): HistorySession => ({
  createdAt: 0,
  id,
  mode: "auto",
  projectId: "project-1",
  provider: "claude" as const,
  sdkSessionId: null,
  title: id,
  updatedAt: 0,
  videoId,
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

const create = (
  id: string,
  subject: string,
  activeForm: string
): TranscriptEntry => ({
  id: `create-${id}`,
  input: { activeForm, subject },
  kind: "activity",
  name: "TaskCreate",
  result: `Task #${id} created successfully: ${subject}`,
  state: "done",
  verb: null,
});

const update = (id: string, status: string): TranscriptEntry => ({
  id: `update-${id}-${status}`,
  input: { status, taskId: id },
  kind: "activity",
  name: "TaskUpdate",
  result: `Updated task #${id} status`,
  state: "done",
  verb: null,
});

const planning = (startedAt = NOW - MINUTE): TurnState => ({
  ...running(startedAt),
  entries: [
    create("1", "Scene component", "Building the scene"),
    create("2", "Register in Series", "Registering the scene"),
    create("3", "Check the build", "Checking the build"),
    update("1", "completed"),
    update("2", "in_progress"),
  ],
});

const unread = (): TurnState => ({ ...IDLE_TURN, unread: true });

const ids = (rows: readonly { session: HistorySession }[]) =>
  rows.map((row) => row.session.id);

describe("paneGroups", () => {
  it("orders exactly as the store gave it when no turn is live", () => {
    const groups = paneGroups(
      [video("promo"), video("teaser")],
      [
        session("newest", "teaser"),
        session("older", "promo"),
        session("oldest", "promo"),
      ],
      new Map()
    );

    expect(groups.map((group) => group.video.id)).toEqual(["promo", "teaser"]);
    expect(ids(groups[0].rows)).toEqual(["older", "oldest"]);
    expect(ids(groups[1].rows)).toEqual(["newest"]);
    expect(groups[0].rollup).toBeNull();
  });

  it("gives a video with no chats an empty group", () => {
    const groups = paneGroups([video("promo")], [], new Map());

    expect(groups[0].rows).toEqual([]);
    expect(groups[0].rollup).toBeNull();
  });

  it("drops a chat whose video is not listed", () => {
    const groups = paneGroups(
      [video("promo")],
      [session("stray", "removed")],
      new Map()
    );

    expect(groups[0].rows).toEqual([]);
  });

  it("floats a waiting session to the top and leads with the longest wait", () => {
    const groups = paneGroups(
      [video("promo")],
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
      [video("promo")],
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

  it("lifts a video with a waiting chat above the rest, leaving the others alone", () => {
    const groups = paneGroups(
      [video("promo"), video("teaser"), video("trailer")],
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

    expect(groups.map((group) => group.video.id)).toEqual([
      "teaser",
      "promo",
      "trailer",
    ]);
  });

  it("rolls up the worst state inside a collapsed group, and counts the waiting", () => {
    const groups = paneGroups(
      [video("promo")],
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
        [video("promo")],
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
      [video("promo")],
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

describe("paneSections", () => {
  const gone = (id: string): Video => video(id, true);

  const names = (list: readonly { video: Video }[]) =>
    list.map((group) => group.video.id);

  it("keeps the videos the bundle still names apart from the ones it does not", () => {
    const sections = paneSections(
      paneGroups([video("promo"), gone("teaser")], [], new Map())
    );

    expect(names(sections.active)).toEqual(["promo"]);
    expect(names(sections.gone)).toEqual(["teaser"]);
  });

  it("keeps the store's order inside each half", () => {
    const sections = paneSections(
      paneGroups(
        [
          gone("first-gone"),
          video("first-here"),
          gone("second-gone"),
          video("second-here"),
        ],
        [],
        new Map()
      )
    );

    expect(names(sections.active)).toEqual(["first-here", "second-here"]);
    expect(names(sections.gone)).toEqual(["first-gone", "second-gone"]);
  });

  it("does not let an absent video's waiting chat lift it above the live ones", () => {
    const sections = paneSections(
      paneGroups(
        [video("promo"), gone("teaser")],
        [session("asking", "teaser"), session("quiet", "promo")],
        new Map([["asking", waiting(NOW - MINUTE)]])
      )
    );

    expect(names(sections.active)).toEqual(["promo"]);
    expect(names(sections.gone)).toEqual(["teaser"]);
  });

  it("still promotes a waiting video within the half it belongs to", () => {
    const sections = paneSections(
      paneGroups(
        [video("quiet-one"), video("asking-one")],
        [session("asking", "asking-one"), session("quiet", "quiet-one")],
        new Map([["asking", waiting(NOW - MINUTE)]])
      )
    );

    expect(names(sections.active)).toEqual(["asking-one", "quiet-one"]);
  });

  it("has both halves empty when there are no videos", () => {
    const sections = paneSections(paneGroups([], [], new Map()));

    expect(sections.active).toEqual([]);
    expect(sections.gone).toEqual([]);
  });
});

describe("sessionMeta", () => {
  const rowOf = (id: string, turn: TurnState) =>
    paneGroups(
      [video("promo")],
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

  it("says which task is running, and how far the plan has got", () => {
    const meta = sessionMeta(rowOf("a", planning(NOW - 2 * MINUTE)), NOW);

    expect(meta).toEqual({
      isError: false,
      text: "Registering the scene · 1/3 · 2m",
    });
  });

  it("keeps the plan's count when nothing is in progress yet", () => {
    const turn: TurnState = {
      ...running(NOW - MINUTE),
      entries: [create("1", "Scene component", "Building the scene")],
    };

    expect(sessionMeta(rowOf("a", turn), NOW)).toEqual({
      isError: false,
      text: "Running · 0/1 · 1m",
    });
  });

  it("says nothing about a plan once the turn has settled", () => {
    const settled: TurnState = { ...planning(), isRunning: false };

    expect(sessionMeta(rowOf("a", settled), NOW)).toBeNull();
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

  it("only marks a completed successful turn, independently of unread state", () => {
    expect(rowOf("a", IDLE_TURN).completed).toBe(false);
    expect(rowOf("a", { ...IDLE_TURN, workedMs: 1200 }).completed).toBe(true);
    expect(
      rowOf("a", { ...IDLE_TURN, unread: true, workedMs: 1200 }).completed
    ).toBe(true);
    expect(rowOf("a", { ...failed("failed"), workedMs: 1200 }).completed).toBe(
      false
    );
    expect(rowOf("a", { ...running(), workedMs: 1200 }).completed).toBe(false);
    expect(rowOf("a", { ...waiting(NOW), workedMs: 1200 }).completed).toBe(
      false
    );
  });
});

// Clicking a video opens its most recent chat, which is the invariant the rest
// of the design leans on: the open chat decides the composition the preview
// plays, the folder in the conventions and the target of an export. The rows
// arrive in the store's own `ORDER BY`, newest first.
describe("newestChat", () => {
  const rows = [
    session("b-new", "video-b"),
    session("a-new", "video-a"),
    session("a-old", "video-a"),
  ];

  it("takes the first row of that video, which is its newest", () => {
    expect(newestChat(rows, "video-a")?.id).toBe("a-new");
    expect(newestChat(rows, "video-b")?.id).toBe("b-new");
  });

  it("is null for a video with no chats yet", () => {
    expect(newestChat(rows, "video-c")).toBeNull();
    expect(newestChat([], "video-a")).toBeNull();
  });

  // Attention promotion happens later, in `paneGroups`, and must not decide
  // what a click opens — a waiting chat rising to the top of the list is a
  // reading order, not a change of which chat is the most recent.
  it("reads the store's order, not the pane's", () => {
    const promoted = paneGroups(
      [video("video-a")],
      rows,
      new Map([["a-old", waiting(NOW - MINUTE)]])
    );

    expect(promoted[0]?.rows[0]?.session.id).toBe("a-old");
    expect(newestChat(rows, "video-a")?.id).toBe("a-new");
  });
});

// Switching projects opens the project's most recent chat, which is the same
// rule one level up: the chat pane has to move with the video list and the
// preview, or the app shows two projects at once.
describe("newestChatIn", () => {
  const rows = [
    { ...session("b-new", "video-b"), projectId: "project-b" },
    { ...session("a-new", "video-a"), projectId: "project-a" },
    { ...session("b-old", "video-b"), projectId: "project-b" },
  ];

  it("takes the first row of that project, which is its newest", () => {
    expect(newestChatIn(rows, "project-b")?.id).toBe("b-new");
    expect(newestChatIn(rows, "project-a")?.id).toBe("a-new");
  });

  it("is null for a project with no chats yet", () => {
    expect(newestChatIn(rows, "project-c")).toBeNull();
  });
});

describe("reuseGroups", () => {
  const videos = [video("promo"), video("teaser")];
  const sessions = [session("a", "promo"), session("b", "teaser")];

  it("keeps every group while a running turn only streams text", () => {
    const first = paneGroups(videos, sessions, new Map([["a", running(NOW)]]));
    const streamed: TurnState = {
      ...running(NOW),
      entries: [{ id: "reply", kind: "assistant", text: "Building it" }],
    };

    const next = reuseGroups(
      first,
      paneGroups(videos, sessions, new Map([["a", streamed]]))
    );

    expect(next).toBe(first);
  });

  it("replaces only the group whose row changed status", () => {
    const first = paneGroups(videos, sessions, new Map());

    const next = reuseGroups(
      first,
      paneGroups(videos, sessions, new Map([["b", failed("it broke")]]))
    );

    expect(next).not.toBe(first);
    const promo = next.find((group) => group.video.id === "promo");
    const teaser = next.find((group) => group.video.id === "teaser");
    expect(promo).toBe(first.find((group) => group.video.id === "promo"));
    expect(teaser?.rows[0]?.status).toBe("failed");
  });
});
