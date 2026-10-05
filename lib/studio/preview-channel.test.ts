import { afterEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import type { PreviewMessage } from "@/preview/protocol";
import { memorySurface, PREVIEW_URL } from "@/test/preview-channel";
import { pauseCommand } from "./preview";
import {
  createPreviewChannel,
  EMPTY_COMPOSITIONS_SETTLE_MS,
} from "./preview-channel";

function composition(
  compositionId: string | null,
  compositions: readonly string[] = compositionId === null
    ? []
    : [compositionId]
): PreviewMessage {
  return {
    compositionId,
    compositions,
    metadata: null,
    reason: compositionId === null ? "none" : "asked",
    total: compositions.length,
    trouble: null,
    type: "composition",
    unmeasured: false,
  };
}

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

function served() {
  const channel = createPreviewChannel();
  const surface = memorySurface();
  channel.serve(PREVIEW_URL);
  channel.attach(surface);
  return { channel, surface };
}

afterEach(() => {
  jest.useRealTimers();
});

describe("createPreviewChannel dispatch", () => {
  it("hands each listener only the messages of its type, decoded", () => {
    const { channel, surface } = served();
    const playheads = mock();
    const rebuilds = mock();
    channel.on("playhead", playheads);
    channel.on("rebuilt", rebuilds);

    surface.emit({ frame: 4, playing: true, type: "playhead" });

    expect(playheads).toHaveBeenCalledWith({
      frame: 4,
      playing: true,
      source: "remocn-preview",
      type: "playhead",
    });
    expect(rebuilds).not.toHaveBeenCalled();
  });

  it("drops a message that does not decode, and says so", () => {
    const { channel, surface } = served();
    const playheads = mock();
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    channel.on("playhead", playheads);

    surface.post({
      frame: 1.5,
      playing: true,
      source: "remocn-preview",
      type: "playhead",
    });

    expect(playheads).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"playhead"');
    warn.mockRestore();
  });

  it("ignores everything until a preview is served", () => {
    const channel = createPreviewChannel();
    const surface = memorySurface();
    const playheads = mock();
    channel.attach(surface);
    channel.on("playhead", playheads);

    surface.emit({ frame: 1, playing: false, type: "playhead" });

    expect(playheads).not.toHaveBeenCalled();
  });

  it("keeps a second listener once the first stops listening", () => {
    const { channel, surface } = served();
    const first = mock();
    const second = mock();
    const stopFirst = channel.on("rebuilt", first);
    channel.on("rebuilt", second);
    stopFirst();

    surface.emit({ type: "rebuilt" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("createPreviewChannel settle", () => {
  it("holds an empty registry back, and publishes it if nothing follows", () => {
    jest.useFakeTimers();
    const { channel, surface } = served();
    const compositions = mock();
    channel.on("composition", compositions);

    surface.emit(composition(null));

    expect(compositions).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EMPTY_COMPOSITIONS_SETTLE_MS);
    expect(compositions).toHaveBeenCalledTimes(1);
  });

  it("drops the held empty registry once a populated one arrives", () => {
    jest.useFakeTimers();
    const { channel, surface } = served();
    const compositions = mock();
    channel.on("composition", compositions);

    surface.emit(composition(null));
    surface.emit(composition("Main"));
    jest.advanceTimersByTime(EMPTY_COMPOSITIONS_SETTLE_MS);

    expect(compositions).toHaveBeenCalledTimes(1);
    expect(compositions.mock.calls[0]?.[0]).toMatchObject({
      compositionId: "Main",
    });
  });

  it("drops the held empty registry when another preview is served", () => {
    jest.useFakeTimers();
    const { channel, surface } = served();
    const compositions = mock();
    channel.on("composition", compositions);

    surface.emit(composition(null));
    channel.serve("http://127.0.0.1:51749/?composition=Intro");
    jest.advanceTimersByTime(EMPTY_COMPOSITIONS_SETTLE_MS);

    expect(compositions).not.toHaveBeenCalled();
  });
});

describe("createPreviewChannel epoch", () => {
  it("moves with the served url, the video on screen and every rebuild", () => {
    const { channel, surface } = served();
    const changes = mock();
    channel.onEpoch(changes);

    expect(channel.epoch()).toEqual({
      build: 0,
      url: PREVIEW_URL,
      video: null,
    });

    surface.emit(composition("Main"));
    surface.emit({ type: "rebuilt" });
    channel.serve(null);

    expect(channel.epoch()).toEqual({ build: 1, url: null, video: "Main" });
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it("keeps the same epoch for a repeated fact", () => {
    const { channel, surface } = served();
    surface.emit(composition("Main"));
    const before = channel.epoch();

    surface.emit(composition("Main"));
    channel.serve(PREVIEW_URL);

    expect(channel.epoch()).toBe(before);
  });

  it("drops transport state and scenes reported for another video", () => {
    const { channel, surface } = served();
    const states = mock();
    const scenes = mock();
    channel.on("transport.state", states);
    channel.on("scenes", scenes);
    surface.emit(composition("Main"));

    surface.emit(transport("Intro"));
    surface.emit({ compositionId: "Intro", scenes: [], type: "scenes" });
    surface.emit(transport("Main"));

    expect(states).toHaveBeenCalledTimes(1);
    expect(states.mock.calls[0]?.[0]).toMatchObject({ compositionId: "Main" });
    expect(scenes).not.toHaveBeenCalled();
  });
});

describe("createPreviewChannel surfaces", () => {
  it("forwards send and focus to the current surface only", () => {
    const { channel, surface } = served();

    channel.send(pauseCommand());
    channel.focus();

    expect(surface.sent).toEqual([pauseCommand()]);
    expect(surface.focused()).toBe(1);
  });

  it("disposes and unsubscribes a surface once a new one is attached", () => {
    const { channel, surface: first } = served();
    const second = memorySurface();

    channel.attach(second);
    channel.send(pauseCommand());

    expect(first.disposed()).toBe(1);
    expect(first.attached()).toBe(false);
    expect(first.sent).toEqual([]);
    expect(second.sent).toEqual([pauseCommand()]);
  });

  it("ignores a message from a surface that has since been replaced", () => {
    const { channel, surface: first } = served();
    const playheads = mock();
    channel.on("playhead", playheads);
    channel.attach(memorySurface());

    first.emit({ frame: 1, playing: false, type: "playhead" });

    expect(playheads).not.toHaveBeenCalled();
  });

  it("stops delivering once the surface disconnects, without a replacement", () => {
    const { channel, surface } = served();
    const playheads = mock();
    channel.on("playhead", playheads);

    channel.disconnect();
    surface.emit({ frame: 1, playing: false, type: "playhead" });
    channel.send(pauseCommand());
    channel.focus();

    expect(playheads).not.toHaveBeenCalled();
    expect(surface.disposed()).toBe(1);
    expect(surface.sent).toEqual([]);
    expect(surface.focused()).toBe(0);
  });

  it("does nothing when a command is sent before any surface attaches", () => {
    const channel = createPreviewChannel();

    expect(() => {
      channel.send(pauseCommand());
      channel.focus();
      channel.disconnect();
    }).not.toThrow();
  });

  it("disposes a surface exactly once even if its own detach runs after a replacement", () => {
    const channel = createPreviewChannel();
    const first = memorySurface();
    const detachFirst = channel.attach(first);
    channel.attach(memorySurface());

    detachFirst();

    expect(first.disposed()).toBe(1);
  });
});
