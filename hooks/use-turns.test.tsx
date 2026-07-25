import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type StartTurn, useTurns } from "@/hooks/use-turns";
import type { PromptResult } from "@/shared/ipc";

const DONE: PromptResult = {
  context: null,
  failure: null,
  sessionId: "sdk-1",
};

function turn(historyId: string, prompt = "make a title card"): StartTurn {
  return {
    attachments: [],
    effort: null,
    historyId,
    model: null,
    projectId: "project-1",
    prompt,
  };
}

function harness() {
  const inflight = new Map<string, (result: PromptResult) => void>();
  const cancelled: string[] = [];
  const byHistory = new Map<string, string>();

  mockIPC((cmd, payload) => {
    if (cmd === "sidecar_request") {
      const call = payload as {
        id: string;
        method: string;
        params: { historyId?: string };
      };
      if (call.method === "claude.prompt") {
        byHistory.set(call.params.historyId ?? "", call.id);
        return new Promise<PromptResult>((resolve) => {
          inflight.set(call.id, resolve);
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
    finish: async (historyId: string) => {
      const id = byHistory.get(historyId) ?? "";
      await act(async () => {
        inflight.get(id)?.(DONE);
        await Promise.resolve();
      });
    },
    wasCancelled: (historyId: string) =>
      cancelled.includes(byHistory.get(historyId) ?? ""),
  };
}

afterEach(() => {
  clearMocks();
});

describe("useTurns", () => {
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

  it("refuses a second turn in a session that is already running", async () => {
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

    expect(result.current.turns.get("a")?.entries).toHaveLength(1);
  });
});
