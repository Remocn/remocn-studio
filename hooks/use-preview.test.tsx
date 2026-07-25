import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePreview } from "@/hooks/use-preview";
import type { PreviewEvent } from "@/shared/ipc";

const FOLDER = "/Users/me/projects/my-video";

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

function mockPreview() {
  const state = { index: 0, stream: 0 };

  mockIPC((cmd, args) => {
    if (cmd === "sidecar_request") {
      const payload = args as Record<string, unknown>;
      state.stream = (payload.onStream as { id: number }).id;
      return new Promise(() => undefined);
    }
    if (cmd === "sidecar_cancel") {
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });

  return {
    send: (event: PreviewEvent) => {
      act(() => {
        internals().runCallback(state.stream, {
          index: state.index,
          message: event,
        });
        state.index += 1;
      });
    },
  };
}

describe("usePreview", () => {
  it("shows the served url once the host is ready", async () => {
    const host = mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    await waitFor(() => {
      expect(result.current.preview.phase).toBe("building");
    });

    host.send({ type: "ready", url: "http://127.0.0.1:51749" });

    expect(result.current.preview).toEqual({
      phase: "ready",
      url: "http://127.0.0.1:51749",
    });
  });

  it("keeps the player up when a late build progress event arrives", async () => {
    const host = mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    await waitFor(() => {
      expect(result.current.preview.phase).toBe("building");
    });

    host.send({ type: "ready", url: "http://127.0.0.1:51749" });
    host.send({ percent: 100, type: "building" });

    expect(result.current.preview).toEqual({
      phase: "ready",
      url: "http://127.0.0.1:51749",
    });
  });

  it("reports a compile error over a running preview", async () => {
    const host = mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    await waitFor(() => {
      expect(result.current.preview.phase).toBe("building");
    });

    host.send({ type: "ready", url: "http://127.0.0.1:51749" });
    host.send({ message: "Unexpected token", type: "failed" });

    expect(result.current.preview).toEqual({
      message: "Unexpected token",
      phase: "failed",
    });
  });

  it("stays idle without a folder", () => {
    const { result } = renderHook(() => usePreview(null));

    expect(result.current.preview).toEqual({ phase: "idle" });
  });

  it("names the fallback composition when there is no Main", async () => {
    mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    announce({ compositionId: "Intro", reason: "first" });

    await waitFor(() => {
      expect(result.current.hint).toBe(
        "No composition called Main, so Intro is playing."
      );
    });
  });

  it("says when the composition came from the folder that was opened", async () => {
    mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    announce({ compositionId: "introducing-opus-5", reason: "folder" });

    await waitFor(() => {
      expect(result.current.hint).toBe(
        "Playing introducing-opus-5, matched from the folder you opened."
      );
    });
  });

  it("stays quiet when Main is what is playing", async () => {
    mockPreview();
    const { result } = renderHook(() => usePreview(FOLDER));

    announce({ compositionId: "Main", reason: "main" });

    await waitFor(() => {
      expect(result.current.preview.phase).toBe("building");
    });

    expect(result.current.hint).toBeNull();
  });
});

function announce(pick: { compositionId: string; reason: string }) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          ...pick,
          source: "remocn-preview",
          total: 2,
          unmeasured: false,
        },
      })
    );
  });
}
