import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSessions } from "@/hooks/use-sessions";
import type { HistorySession } from "@/shared/ipc";

const WINDOW = "40 millis";
const PAST_WINDOW = 120;

const STORED: HistorySession[] = [
  {
    createdAt: 0,
    id: "newest",
    mode: "auto",
    projectId: "project-1",
    sdkSessionId: null,
    title: "Newest",
    updatedAt: 3,
  },
  {
    createdAt: 0,
    id: "middle",
    mode: "auto",
    projectId: "project-1",
    sdkSessionId: null,
    title: "Middle",
    updatedAt: 2,
  },
  {
    createdAt: 0,
    id: "oldest",
    mode: "auto",
    projectId: "project-1",
    sdkSessionId: null,
    title: "Oldest",
    updatedAt: 1,
  },
];

function harness() {
  const removed: string[] = [];

  mockIPC((cmd, payload) => {
    if (cmd !== "sidecar_request") {
      throw new Error(`unexpected command: ${cmd}`);
    }

    const call = payload as {
      method: string;
      params: { sessionId?: string } | null;
    };

    if (call.method === "history.sessions") {
      return STORED;
    }
    if (call.method === "history.remove") {
      removed.push(call.params?.sessionId ?? "");
      return { removed: true };
    }
    throw new Error(`unexpected method: ${call.method}`);
  });

  return { removed };
}

function click(sessionId: string) {
  return {
    currentTarget: { value: sessionId },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

async function loaded() {
  const { result } = renderHook(() => useSessions(WINDOW));
  await waitFor(() => expect(result.current.sessions).toHaveLength(3));
  return result;
}

const ids = (rows: readonly HistorySession[]) => rows.map((row) => row.id);

const pause = (ms: number) =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      })
  );

afterEach(() => {
  clearMocks();
});

describe("useSessions", () => {
  it("takes the row off screen at once and holds the removal back", async () => {
    const ipc = harness();
    const result = await loaded();

    act(() => {
      result.current.onRemoveSession(click("middle"));
    });

    expect(ids(result.current.sessions)).toEqual(["newest", "oldest"]);
    expect(ipc.removed).toEqual([]);
  });

  it("removes the session once the undo window has passed", async () => {
    const ipc = harness();
    const result = await loaded();

    act(() => {
      result.current.onRemoveSession(click("middle"));
    });
    await pause(PAST_WINDOW);

    expect(ipc.removed).toEqual(["middle"]);
    expect(ids(result.current.sessions)).toEqual(["newest", "oldest"]);
  });

  it("puts an undone session back exactly where it was, and never removes it", async () => {
    const ipc = harness();
    const result = await loaded();

    act(() => {
      result.current.onRemoveSession(click("middle"));
    });
    act(() => {
      result.current.undoRemoveSession("middle");
    });
    await pause(PAST_WINDOW);

    expect(ids(result.current.sessions)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
    expect(ipc.removed).toEqual([]);
  });

  it("gives an undone session back the selection it had", async () => {
    harness();
    const result = await loaded();

    act(() => {
      result.current.selectSession(STORED[1]);
    });
    act(() => {
      result.current.onRemoveSession(click("middle"));
    });

    expect(result.current.activeSession).toBeNull();

    act(() => {
      result.current.undoRemoveSession("middle");
    });

    expect(result.current.activeSession?.id).toBe("middle");
    expect(result.current.openedSession?.id).toBe("middle");
  });

  it("ignores an undo once the window has closed", async () => {
    const ipc = harness();
    const result = await loaded();

    act(() => {
      result.current.onRemoveSession(click("middle"));
    });
    await pause(PAST_WINDOW);

    act(() => {
      result.current.undoRemoveSession("middle");
    });

    expect(ids(result.current.sessions)).toEqual(["newest", "oldest"]);
    expect(ipc.removed).toEqual(["middle"]);
  });

  it("drops a held removal when the whole project goes", async () => {
    const ipc = harness();
    const result = await loaded();

    act(() => {
      result.current.onRemoveSession(click("middle"));
    });
    act(() => {
      result.current.forgetSessionsOf("project-1");
    });
    await pause(PAST_WINDOW);

    expect(result.current.sessions).toEqual([]);
    expect(ipc.removed).toEqual([]);
  });
});
