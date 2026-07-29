import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type PreviewListener,
  useOnPreview,
  usePreview,
} from "@/hooks/use-preview";
import type { PreviewEvent } from "@/shared/ipc";

const FOLDER = "/Users/me/projects/my-video";
const URL = "http://127.0.0.1:51749";

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

function listener(): PreviewListener {
  return vi.fn();
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

function post(data: unknown, origin = URL) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  });
}

function announce(
  pick: { compositionId: string; reason: string },
  origin = URL
) {
  post(
    {
      ...pick,
      source: "remocn-preview",
      total: 2,
      type: "composition",
      unmeasured: false,
    },
    origin
  );
}

const SELECTION = {
  element: {
    column: 7,
    component: "TitleCard",
    composition: "Main",
    file: "/Users/me/projects/my-video/src/TitleCard.tsx",
    fps: 30,
    frame: 42,
    html: "<h1>Hello</h1>",
    line: 12,
    scene: null,
    stack: [],
  },
  rect: { height: 0.2, width: 0.5, x: 0.25, y: 0.4 },
  source: "remocn-preview",
  type: "selection",
};

async function served(listen: PreviewListener = listener()) {
  const host = mockPreview();
  const rendered = renderHook(() => {
    const preview = usePreview(FOLDER);
    useOnPreview(preview, listen);
    return preview;
  });

  await waitFor(() => {
    expect(rendered.result.current.preview.phase).toBe("building");
  });

  host.send({ type: "ready", url: URL });

  return { host, rendered };
}

describe("usePreview", () => {
  it("shows the served url once the host is ready", async () => {
    const { rendered } = await served();

    expect(rendered.result.current.preview).toEqual({
      phase: "ready",
      url: URL,
    });
    expect(rendered.result.current.isServing).toBe(true);
  });

  it("keeps the player up when a late build progress event arrives", async () => {
    const { host, rendered } = await served();

    host.send({ percent: 100, type: "building" });

    expect(rendered.result.current.preview).toEqual({
      phase: "ready",
      url: URL,
    });
  });

  it("reports a compile error over a running preview", async () => {
    const { host, rendered } = await served();

    host.send({ message: "Unexpected token", type: "failed" });

    expect(rendered.result.current.preview).toEqual({
      message: "Unexpected token",
      phase: "failed",
    });
    expect(rendered.result.current.isServing).toBe(false);
  });

  it("stays idle without a folder", () => {
    const { result } = renderHook(() => usePreview(null));

    expect(result.current.preview).toEqual({ phase: "idle" });
    expect(result.current.isServing).toBe(false);
  });

  it("names the fallback composition when there is no Main", async () => {
    const { rendered } = await served();

    announce({ compositionId: "Intro", reason: "first" });

    await waitFor(() => {
      expect(rendered.result.current.hint).toBe(
        "No composition called Main, so Intro is playing."
      );
    });
  });

  it("says when the composition came from the folder that was opened", async () => {
    const { rendered } = await served();

    announce({ compositionId: "introducing-opus-5", reason: "folder" });

    await waitFor(() => {
      expect(rendered.result.current.hint).toBe(
        "Playing introducing-opus-5, matched from the folder you opened."
      );
    });
  });

  it("stays quiet when Main is what is playing", async () => {
    const { rendered } = await served();

    announce({ compositionId: "Main", reason: "main" });

    expect(rendered.result.current.hint).toBeNull();
  });

  it("hands a selection to whoever is collecting them", async () => {
    const listen = listener();
    await served(listen);

    post(SELECTION);

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ type: "selection" })
    );
  });

  it("hears the preview answer that it armed", async () => {
    const listen = listener();
    await served(listen);

    post({
      paused: true,
      source: "remocn-preview",
      status: "armed",
      type: "inspect",
    });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ paused: true, status: "armed" })
    );
  });

  it("hears the preview say it could not arm", async () => {
    const listen = listener();
    await served(listen);

    post({
      paused: true,
      source: "remocn-preview",
      status: "no-grab",
      type: "inspect",
    });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no-grab" })
    );
  });

  it("hands a captured frame to whoever is collecting them", async () => {
    const listen = listener();
    await served(listen);

    post({
      composition: "Main",
      frame: 42,
      rect: { height: 0.2, width: 0.5, x: 0.25, y: 0.4 },
      source: "remocn-preview",
      type: "capture",
    });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ frame: 42, type: "capture" })
    );
  });

  it("says when the project recompiled, so the markers can go", async () => {
    const listen = listener();
    await served(listen);

    post({ source: "remocn-preview", type: "rebuilt" });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rebuilt" })
    );
  });

  it("ignores a selection that did not come from the preview's origin", async () => {
    const listen = listener();
    await served(listen);

    post(SELECTION, "http://evil.example");

    expect(listen).not.toHaveBeenCalled();
  });

  it("ignores anything posted before there is a preview to trust", () => {
    const listen = listener();
    mockPreview();
    renderHook(() => {
      const preview = usePreview(FOLDER);
      useOnPreview(preview, listen);
      return preview;
    });

    post(SELECTION);

    expect(listen).not.toHaveBeenCalled();
  });
});
