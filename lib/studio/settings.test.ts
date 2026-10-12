import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect } from "effect";
import {
  hydrateSettings,
  readCanvasCamera,
  saveCanvasCamera,
  saveCanvasRulers,
  saveNotifications,
  saveNotifyEvent,
} from "@/lib/studio/settings";

const STORE_RID = 7;

function store(entries: readonly [string, unknown][]) {
  const written = new Map<string, unknown>();
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:store|load") {
      return STORE_RID;
    }
    if (cmd === "plugin:store|entries") {
      return entries;
    }
    if (cmd === "plugin:store|set") {
      const { key, value } = payload as { key: string; value: unknown };
      written.set(key, value);
      return null;
    }
    if (cmd === "plugin:store|save") {
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return written;
}

describe("hydrateSettings", () => {
  beforeEach(() => {
    store([]);
  });

  it("reads a file without the notifications key as unanswered", async () => {
    const settings = await Effect.runPromise(hydrateSettings);

    expect(settings.notifications).toBeNull();
  });

  it("reads the notifications switch back", async () => {
    store([["notifications", "enabled"]]);

    expect((await Effect.runPromise(hydrateSettings)).notifications).toBe(true);

    store([["notifications", "disabled"]]);

    expect((await Effect.runPromise(hydrateSettings)).notifications).toBe(
      false
    );
  });

  it("reads a missing event key as unanswered and a stored one back", async () => {
    store([["notifyExport", "disabled"]]);

    const { notifyEvents } = await Effect.runPromise(hydrateSettings);

    expect(notifyEvents).toEqual({
      export: false,
      sidecar: null,
      turnEnded: null,
      waiting: null,
    });
  });

  it("writes an event switch under its own key", async () => {
    const written = store([]);
    await Effect.runPromise(hydrateSettings);

    await Effect.runPromise(saveNotifyEvent("waiting", false));

    expect(written.get("notifyWaiting")).toBe("disabled");
  });

  it("writes the switch as a word", async () => {
    const written = store([]);
    await Effect.runPromise(hydrateSettings);

    await Effect.runPromise(saveNotifications(true));

    expect(written.get("notifications")).toBe("enabled");
  });
});

describe("canvas settings", () => {
  it("reads the rulers switch back and writes it as a word", async () => {
    store([["canvasRulers", "hidden"]]);
    expect((await Effect.runPromise(hydrateSettings)).canvasRulers).toBe(false);

    const written = store([]);
    const settings = await Effect.runPromise(hydrateSettings);
    expect(settings.canvasRulers).toBeNull();

    await Effect.runPromise(saveCanvasRulers(true));
    expect(written.get("canvasRulers")).toBe("shown");
  });

  it("reads a remembered camera back after a launch", async () => {
    store([
      [
        "canvasCameras",
        JSON.stringify([
          { key: "p:intro:1920:1080", x: 960, y: 540, zoom: 2 },
          { key: "broken", x: "left", y: 0, zoom: 1 },
        ]),
      ],
    ]);
    await Effect.runPromise(hydrateSettings);

    expect(readCanvasCamera("p:intro:1920:1080")).toEqual({
      x: 960,
      y: 540,
      zoom: 2,
    });
    expect(readCanvasCamera("broken")).toBeNull();
    expect(readCanvasCamera("p:outro:1920:1080")).toBeNull();
  });

  it("keeps the fifty most recent cameras, newest first", async () => {
    const written = store([]);
    await Effect.runPromise(hydrateSettings);

    await Effect.runPromise(
      Effect.forEach(
        Array.from({ length: 52 }, (_, index) => index),
        (index) =>
          saveCanvasCamera(`video-${index}`, { x: index, y: 0, zoom: 1 }),
        { discard: true }
      )
    );
    await Effect.runPromise(
      saveCanvasCamera("video-10", { x: 5, y: 5, zoom: 3 })
    );

    const saved = JSON.parse(String(written.get("canvasCameras"))) as {
      key: string;
    }[];
    expect(saved).toHaveLength(50);
    expect(saved[0]).toEqual({ key: "video-10", x: 5, y: 5, zoom: 3 });
    expect(saved.map((entry) => entry.key)).not.toContain("video-1");
    expect(readCanvasCamera("video-10")).toEqual({ x: 5, y: 5, zoom: 3 });
  });
});

it("restores Captions and discards an unsupported pane value", async () => {
  store([["paneView", "captions"]]);
  expect((await Effect.runPromise(hydrateSettings)).paneView).toBe("captions");
  store([["paneView", "unknown-pane"]]);
  expect((await Effect.runPromise(hydrateSettings)).paneView).toBeNull();
});
