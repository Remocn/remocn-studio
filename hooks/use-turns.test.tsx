import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type StartTurn, useTurns } from "@/hooks/use-turns";
import type {
  HistorySession,
  PromptResult,
  TranscriptEntry,
} from "@/shared/ipc";
import type { PipelineStage } from "@/shared/pipeline";

const DONE: PromptResult = {
  context: null,
  failure: null,
  sessionId: "sdk-1",
};

const STORED: HistorySession = {
  createdAt: 0,
  id: "a",
  mode: "plan",
  projectId: "project-1",
  sdkSessionId: "sdk-9",
  title: "A promo",
  updatedAt: 0,
};

const STAGES: PipelineStage[] = [
  { stage: "analysis", status: "done" },
  { stage: "brand", status: "active" },
];

const BLOCKS: TranscriptEntry[] = [
  {
    assets: [],
    attachments: [],
    elements: [],
    id: "block-0",
    kind: "user",
    media: [],
    text: "make a title card",
  },
  { id: "block-1", kind: "assistant", text: "Building it now." },
];

function turn(historyId: string, prompt = "make a title card"): StartTurn {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId,
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId: "project-1",
    prompt,
  };
}

function harness(options: { holdBlocks?: boolean } = {}) {
  const inflight = new Map<string, (result: PromptResult) => void>();
  const cancelled: string[] = [];
  const byHistory = new Map<string, string>();
  const modes = new Map<string, string>();
  const blocks: ((entries: TranscriptEntry[]) => void)[] = [];

  mockIPC((cmd, payload) => {
    if (cmd === "sidecar_request") {
      const call = payload as {
        id: string;
        method: string;
        params: { historyId?: string; mode?: string; sessionId?: string };
      };
      if (call.method === "claude.prompt") {
        byHistory.set(call.params.historyId ?? "", call.id);
        modes.set(call.params.historyId ?? "", call.params.mode ?? "");
        return new Promise<PromptResult>((resolve) => {
          inflight.set(call.id, resolve);
        });
      }
      if (call.method === "pipeline.get") {
        return { sessionId: call.params.sessionId ?? "", stages: STAGES };
      }
      if (call.method === "history.blocks") {
        if (options.holdBlocks !== true) {
          return BLOCKS;
        }
        return new Promise<TranscriptEntry[]>((resolve) => {
          blocks.push(resolve);
        });
      }
      throw new Error(`unexpected method: ${call.method}`);
    }
    if (cmd === "sidecar_cancel") {
      cancelled.push((payload as { id: string }).id);
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });

  return {
    cancelled,
    deliverBlocks: async () => {
      await act(async () => {
        for (const resolve of blocks) {
          resolve(BLOCKS);
        }
        await Promise.resolve();
      });
    },
    fail: async (historyId: string, message: string) => {
      const id = byHistory.get(historyId) ?? "";
      await act(async () => {
        inflight.get(id)?.({
          ...DONE,
          failure: { kind: "unknown", message },
        });
        await Promise.resolve();
      });
    },
    finish: async (historyId: string) => {
      const id = byHistory.get(historyId) ?? "";
      await act(async () => {
        inflight.get(id)?.(DONE);
        await Promise.resolve();
      });
    },
    sentMode: (historyId: string) => modes.get(historyId) ?? null,
    wasCancelled: (historyId: string) =>
      cancelled.includes(byHistory.get(historyId) ?? ""),
  };
}

afterEach(() => {
  clearMocks();
});

describe("useTurns", () => {
  it("puts a stored session's blocks on screen when it is opened", async () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.loadTurn(STORED);
    });

    await waitFor(() => {
      expect(result.current.turns.get("a")?.isLoading).toBe(false);
    });
    expect(result.current.turns.get("a")?.entries).toEqual(BLOCKS);
    expect(result.current.turns.get("a")?.sdkSessionId).toBe("sdk-9");
  });

  it("brings a stored session's pipeline back with its blocks", async () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.loadTurn(STORED);
    });

    await waitFor(() => {
      expect(result.current.turns.get("a")?.stages).toEqual(STAGES);
    });
  });

  it("loads a session's blocks once, however often it is opened", async () => {
    const ipc = harness({ holdBlocks: true });
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.loadTurn(STORED);
      result.current.loadTurn(STORED);
    });
    await ipc.deliverBlocks();

    await waitFor(() => {
      expect(result.current.turns.get("a")?.entries).toHaveLength(2);
    });
  });

  it("keeps a turn started mid-load below the blocks it was loading", async () => {
    const ipc = harness({ holdBlocks: true });
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.loadTurn(STORED);
    });
    act(() => {
      result.current.sendTurn(turn("a", "now in red"));
    });
    await ipc.deliverBlocks();

    await waitFor(() => {
      expect(result.current.turns.get("a")?.entries).toHaveLength(3);
    });
    expect(result.current.turns.get("a")?.entries.at(-1)).toMatchObject({
      kind: "user",
      text: "now in red",
    });
  });

  it("keeps a turn running while another session is on screen", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.markOpen("a");
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.markOpen("b");
      result.current.sendTurn(turn("b", "now in red"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("b")?.isRunning).toBe(true)
    );

    expect(result.current.turns.get("a")?.isRunning).toBe(true);
    expect(ipc.wasCancelled("a")).toBe(false);
    expect(result.current.hasRunningTurns).toBe(true);
  });

  it("marks a turn that finished while its session was away", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.markOpen("a");
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.markOpen("b");
    });
    await ipc.finish("a");

    await waitFor(() => {
      expect(result.current.turns.get("a")?.isRunning).toBe(false);
    });
    expect(result.current.turns.get("a")?.unread).toBe(true);
    expect(result.current.hasRunningTurns).toBe(false);

    act(() => {
      result.current.markOpen("a");
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.unread).toBe(false)
    );
  });

  it("leaves no unread mark on a turn you watched finish", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.markOpen("a");
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    await ipc.finish("a");

    await waitFor(() => {
      expect(result.current.turns.get("a")?.isRunning).toBe(false);
    });
    expect(result.current.turns.get("a")?.unread).toBe(false);
    expect(result.current.turns.get("a")?.sdkSessionId).toBe("sdk-1");
  });

  it("cancels the request behind the session it is told to stop", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
      result.current.sendTurn(turn("b", "now in red"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("b")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.stopTurn("b");
    });

    await waitFor(() => expect(ipc.wasCancelled("b")).toBe(true));
    expect(ipc.wasCancelled("a")).toBe(false);
  });

  it("brings a stored session back in the mode it was left in", async () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.loadTurn(STORED);
    });

    await waitFor(() => {
      expect(result.current.turns.get("a")?.mode).toBe("plan");
    });
  });

  it("runs the turn in the mode its session is set to", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.setTurnMode("a", "plan");
    });
    act(() => {
      result.current.sendTurn({ ...turn("a"), mode: "plan" });
    });

    await waitFor(() => expect(ipc.sentMode("a")).toBe("plan"));
    expect(result.current.turns.get("a")?.mode).toBe("plan");
  });

  it("queues a second message instead of dropping it", async () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      expect(result.current.sendTurn(turn("a", "and again"))).toBe(true);
    });

    expect(result.current.turns.get("a")?.entries).toHaveLength(1);
    expect(result.current.turns.get("a")?.queue).toHaveLength(1);
    expect(result.current.turns.get("a")?.queue[0].text).toBe("and again");
  });

  it("refuses a message with nothing in it", () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      expect(result.current.sendTurn(turn("a", "   "))).toBe(false);
    });

    expect(result.current.turns.get("a")).toBeUndefined();
  });

  it("sends the head of the queue when the turn settles", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.markOpen("a");
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.sendTurn(turn("a", "and again"));
      result.current.sendTurn(turn("a", "then this"));
    });
    await ipc.finish("a");

    await waitFor(() =>
      expect(result.current.turns.get("a")?.entries).toHaveLength(2)
    );
    expect(result.current.turns.get("a")?.entries.at(-1)).toMatchObject({
      kind: "user",
      text: "and again",
    });
    expect(result.current.turns.get("a")?.isRunning).toBe(true);
    expect(
      result.current.turns.get("a")?.queue.map((message) => message.text)
    ).toEqual(["then this"]);
  });

  it("runs the queued message in the mode the session ended in", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.setTurnMode("a", "plan");
      result.current.sendTurn(turn("a", "and again"));
    });
    await ipc.finish("a");

    await waitFor(() => expect(ipc.sentMode("a")).toBe("plan"));
  });

  it("keeps the queue where it is when the turn is stopped by hand", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.sendTurn(turn("a", "and again"));
      result.current.stopTurn("a");
    });

    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(false)
    );
    expect(ipc.wasCancelled("a")).toBe(true);
    expect(result.current.turns.get("a")?.queue).toHaveLength(1);
    expect(result.current.turns.get("a")?.entries).toHaveLength(1);
  });

  it("keeps the queue where it is when the turn failed", async () => {
    const ipc = harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.sendTurn(turn("a", "and again"));
    });
    await ipc.fail("a", "the model refused");

    await waitFor(() =>
      expect(result.current.turns.get("a")?.error).toBe("the model refused")
    );
    expect(result.current.turns.get("a")?.queue).toHaveLength(1);
    expect(result.current.turns.get("a")?.entries).toHaveLength(1);
  });

  it("forgets a queued message it is told to drop", async () => {
    harness();
    const { result } = renderHook(() => useTurns(vi.fn()));

    act(() => {
      result.current.sendTurn(turn("a"));
    });
    await waitFor(() =>
      expect(result.current.turns.get("a")?.isRunning).toBe(true)
    );

    act(() => {
      result.current.sendTurn(turn("a", "and again"));
    });
    const queued = result.current.turns.get("a")?.queue[0];

    act(() => {
      result.current.removeQueued("a", queued?.id ?? "");
    });

    expect(result.current.turns.get("a")?.queue).toHaveLength(0);
  });
});
