import { afterEach, describe, expect, it, jest, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import {
  type PreviewControl,
  usePreview,
  usePreviewReport,
} from "@/hooks/use-preview";
import type { PreviewMessage } from "@/preview/protocol";
import type { PreviewEvent, SidecarPhase } from "@/shared/ipc";
import { memorySurface, previewControl } from "@/test/preview-channel";

const FOLDER = "/Users/me/projects/my-video";
const URL = "http://127.0.0.1:51749";
let deliver: ((message: unknown) => void) | null = null;

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

type Listener = (message: unknown) => void;

const HEARD = [
  "capture",
  "composition",
  "inspect",
  "rebuilt",
  "selection",
] as const;

function listener(): Listener {
  return mock();
}

function useHeard(preview: PreviewControl, listen: Listener) {
  const { channel } = preview;
  useEffect(() => {
    const stops = HEARD.map((type) => channel.on(type, listen));
    return () => {
      for (const stop of stops) {
        stop();
      }
    };
  }, [channel, listen]);
}

function mockPreview() {
  const state = { index: 0, requests: 0, stream: 0 };

  mockIPC((cmd, args) => {
    if (cmd === "sidecar_request") {
      state.requests += 1;
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
    requests: () => state.requests,
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

function attach(preview: PreviewControl) {
  const surface = memorySurface();
  act(() => {
    preview.attachSurface(surface);
  });
  deliver = surface.post;
  return (data: unknown) => act(() => surface.post(data));
}

function post(data: unknown) {
  act(() => {
    deliver?.(data);
  });
}

function announce(pick: { compositionId: string; reason: string }) {
  post({
    ...pick,
    compositions: ["Main", "Intro"],
    source: "remocn-preview",
    total: 2,
    type: "composition",
    unmeasured: false,
  });
}

function announceEmpty() {
  post({
    compositionId: null,
    compositions: [],
    reason: "none",
    source: "remocn-preview",
    total: 0,
    type: "composition",
    unmeasured: false,
  });
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

async function served(
  listen: Listener = listener(),
  composition: string | null = null,
  phase: SidecarPhase | "unknown" = "ready"
) {
  const host = mockPreview();
  const rendered = renderHook(() => {
    const preview = usePreview(FOLDER, composition, phase);
    useHeard(preview, listen);
    return preview;
  });

  await waitFor(() => {
    expect(rendered.result.current.preview.phase).toBe("building");
  });

  attach(rendered.result.current);
  host.send({ type: "ready", url: URL });

  return { host, rendered };
}

afterEach(() => {
  jest.useRealTimers();
  deliver = null;
});

describe("usePreview", () => {
  it("asks the served page for the video it is showing", async () => {
    const { rendered } = await served(listener(), "opening-title");

    await waitFor(() => {
      expect(rendered.result.current.preview).toEqual({
        phase: "ready",
        url: `${URL}/?composition=opening-title`,
      });
    });
  });

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

  // webpack reports 100% once its cache goes idle, which is after the watch
  // callback has already said the compile failed.
  it("keeps the compile error up when a late build progress event arrives", async () => {
    const { host, rendered } = await served();

    host.send({ message: "Unexpected token", type: "failed" });
    host.send({ percent: 100, type: "building" });

    expect(rendered.result.current.preview).toEqual({
      message: "Unexpected token",
      phase: "failed",
    });

    host.send({ percent: 0, type: "building" });

    expect(rendered.result.current.preview).toEqual({
      percent: 0,
      phase: "building",
    });
  });

  it("plays again once a broken rebuild is fixed", async () => {
    const { host, rendered } = await served();

    host.send({ message: "Unexpected token", type: "failed" });
    host.send({ percent: 0, type: "building" });
    host.send({ percent: 100, type: "building" });

    expect(rendered.result.current.preview).toEqual({
      percent: 100,
      phase: "building",
    });

    host.send({ type: "ready", url: URL });

    expect(rendered.result.current.preview).toEqual({
      phase: "ready",
      url: URL,
    });
    expect(rendered.result.current.isServing).toBe(true);
  });

  // Killing the sidecar failed the preview's long-lived request and nothing
  // brought it back: every other pane healed itself, and the one that costs
  // seven seconds to rebuild sat dead behind an unlabelled Restart button.
  it("comes back on its own when the sidecar does", async () => {
    const host = mockPreview();
    const rendered = renderHook(
      ({ phase }: { phase: SidecarPhase | "unknown" }) =>
        usePreview(FOLDER, null, phase),
      { initialProps: { phase: "ready" as SidecarPhase | "unknown" } }
    );

    host.send({ type: "ready", url: URL });
    await waitFor(() => {
      expect(rendered.result.current.isServing).toBe(true);
    });

    host.send({ message: "cancelled", type: "failed" });
    rendered.rerender({ phase: "restarting" });

    await waitFor(() => {
      expect(rendered.result.current.preview).toEqual({
        message: "The preview stopped when the studio's helper restarted.",
        phase: "failed",
      });
    });

    rendered.rerender({ phase: "ready" });

    await waitFor(() => {
      expect(rendered.result.current.preview.phase).toBe("building");
    });
  });

  it("does not relaunch when the sidecar was never lost", async () => {
    const host = mockPreview();
    const rendered = renderHook(
      ({ phase }: { phase: SidecarPhase | "unknown" }) =>
        usePreview(FOLDER, null, phase),
      { initialProps: { phase: "starting" as SidecarPhase | "unknown" } }
    );

    host.send({ type: "ready", url: URL });
    await waitFor(() => {
      expect(rendered.result.current.isServing).toBe(true);
    });

    rendered.rerender({ phase: "ready" });

    await waitFor(() => {
      expect(rendered.result.current.isServing).toBe(true);
    });
  });

  it("stays idle without a folder", () => {
    const { result } = renderHook(() => usePreview(null, null, "ready"));

    expect(result.current.preview).toEqual({ phase: "idle" });
    expect(result.current.isServing).toBe(false);
  });

  it("names the fallback composition when none was asked for", async () => {
    const { rendered } = await served();

    announce({ compositionId: "Intro", reason: "first" });

    await waitFor(() => {
      expect(rendered.result.current.hint).toBe(
        "No video was asked for, so Intro is playing."
      );
    });
  });

  it("says so rather than letting a neighbour stand in for the video", async () => {
    const { rendered } = await served(listener(), "torrens-motherboard");

    announce({ compositionId: "torrens-motherboard", reason: "missing" });

    await waitFor(() => {
      expect(rendered.result.current.hint).toContain(
        "Nothing in this project renders torrens-motherboard"
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

  it("does not publish a transient empty registry before compositions register", async () => {
    const listen = listener();
    const { rendered } = await served(listen);
    jest.useFakeTimers();

    announceEmpty();

    expect(rendered.result.current.pick).toBeNull();
    expect(listen).not.toHaveBeenCalledWith(
      expect.objectContaining({ total: 0, type: "composition" })
    );

    announce({ compositionId: "Main", reason: "main" });

    expect(rendered.result.current.pick).toEqual(
      expect.objectContaining({ compositionId: "Main", total: 2 })
    );
    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ total: 2, type: "composition" })
    );

    act(() => jest.runAllTimers());
    expect(listen).not.toHaveBeenCalledWith(
      expect.objectContaining({ total: 0, type: "composition" })
    );
  });

  it("publishes an empty registry when the project is genuinely empty", async () => {
    const listen = listener();
    const { rendered } = await served(listen);
    jest.useFakeTimers();

    announceEmpty();
    act(() => jest.advanceTimersByTime(249));

    expect(rendered.result.current.pick).toBeNull();
    expect(listen).not.toHaveBeenCalledWith(
      expect.objectContaining({ total: 0, type: "composition" })
    );

    act(() => jest.advanceTimersByTime(1));

    expect(rendered.result.current.pick).toEqual(
      expect.objectContaining({ compositionId: null, total: 0 })
    );
    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ total: 0, type: "composition" })
    );
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
      status: "no-canvas",
      type: "inspect",
    });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no-canvas" })
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

  it("follows the playhead: the frame it is on and whether it plays", async () => {
    const { rendered } = await served();

    post({
      frame: 12,
      playing: true,
      source: "remocn-preview",
      type: "playhead",
    });

    expect(rendered.result.current.frameOf()).toBe(12);
    expect(rendered.result.current.playing).toBe(true);
  });

  it("keeps the current time when properties trigger a rebuild", async () => {
    const { rendered } = await served();
    post({
      frame: 390,
      playing: false,
      source: "remocn-preview",
      type: "playhead",
    });
    expect(rendered.result.current.frameOf()).toBe(390);
    post({ source: "remocn-preview", type: "rebuilt" });
    expect(rendered.result.current.frameOf()).toBe(390);
  });

  it("says when the project recompiled, so the markers can go", async () => {
    const listen = listener();
    await served(listen);

    post({ source: "remocn-preview", type: "rebuilt" });

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rebuilt" })
    );
  });

  it("ignores a surface that has since been replaced", async () => {
    const listen = listener();
    const { rendered } = await served(listen);
    const replaced = attach(rendered.result.current);
    attach(rendered.result.current);

    replaced(SELECTION);

    expect(listen).not.toHaveBeenCalled();
  });

  it("ignores anything posted before there is a preview to trust", () => {
    const listen = listener();
    mockPreview();
    renderHook(() => {
      const preview = usePreview(FOLDER, null, "ready");
      useHeard(preview, listen);
      return preview;
    });

    post(SELECTION);

    expect(listen).not.toHaveBeenCalled();
  });

  it("reloads the page for another video of the same project rather than compiling again", async () => {
    const host = mockPreview();
    const rendered = renderHook(
      ({ composition }: { composition: string | null }) =>
        usePreview(FOLDER, composition, "ready"),
      { initialProps: { composition: "opening-title" } }
    );

    await waitFor(() => {
      expect(rendered.result.current.preview.phase).toBe("building");
    });
    host.send({ type: "ready", url: URL });
    await waitFor(() => {
      expect(rendered.result.current.preview).toEqual({
        phase: "ready",
        url: `${URL}/?composition=opening-title`,
      });
    });
    expect(host.requests()).toBe(1);

    rendered.rerender({ composition: "closing-scene" });

    expect(rendered.result.current.preview).toEqual({
      phase: "ready",
      url: `${URL}/?composition=closing-scene`,
    });
    expect(host.requests()).toBe(1);
  });
});

function transport(compositionId: string): PreviewMessage {
  return {
    buffering: false,
    compositionId,
    error: null,
    muted: false,
    type: "transport.state",
    volume: 1,
  };
}

function shown(compositionId: string): PreviewMessage {
  return {
    compositionId,
    compositions: [compositionId],
    metadata: null,
    reason: "asked",
    total: 1,
    trouble: null,
    type: "composition",
    unmeasured: false,
  };
}

describe("usePreviewReport", () => {
  function reports() {
    const { preview, surface } = previewControl();
    const emit = (message: PreviewMessage) => act(() => surface.emit(message));
    emit(shown("intro"));
    const rendered = renderHook(() => ({
      layers: usePreviewReport(preview, "studio.present", "build"),
      state: usePreviewReport(preview, "transport.state", "video"),
    }));
    emit(transport("intro"));
    emit({ ids: ["title"], type: "studio.present" });
    return { emit, preview, rendered };
  }

  it("holds the latest report of its type", () => {
    const { rendered } = reports();

    expect(rendered.result.current.state).toMatchObject({
      compositionId: "intro",
    });
    expect(rendered.result.current.layers).toMatchObject({ ids: ["title"] });
  });

  it("keeps a video's report across a rebuild, and drops a build's", () => {
    const { emit, rendered } = reports();

    emit({ type: "rebuilt" });

    expect(rendered.result.current.state).toMatchObject({
      compositionId: "intro",
    });
    expect(rendered.result.current.layers).toBeNull();
  });

  it("drops a video's report once another video is on screen, and keeps a build's", () => {
    const { emit, rendered } = reports();

    emit(shown("outro"));

    expect(rendered.result.current.state).toBeNull();
    expect(rendered.result.current.layers).toMatchObject({ ids: ["title"] });

    emit(transport("outro"));

    expect(rendered.result.current.state).toMatchObject({
      compositionId: "outro",
    });
  });

  it("drops a video's report once another preview is served, and keeps a build's", () => {
    const { preview, rendered } = reports();

    act(() => preview.channel.serve("http://127.0.0.1:51749/?composition=x"));

    expect(rendered.result.current.state).toBeNull();
    expect(rendered.result.current.layers).toMatchObject({ ids: ["title"] });
  });
});
