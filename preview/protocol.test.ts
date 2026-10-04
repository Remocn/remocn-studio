import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { PlayerRef } from "@remotion/player";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Exit } from "effect";
import { decodePreviewMessage } from "@/lib/studio/preview";
import { type TestSurface, withSurface } from "@/test/surface";
import { post } from "./bridge";
import { describe as describeComposition, pick } from "./composition";
import { armInspect, type Stage } from "./inspect";
import { watchPresence } from "./presence";
import type { MessageType } from "./protocol";
import { useSceneObserver } from "./scenes-report";
import { armSnapshot } from "./snapshot";
import { usePlayerTransport } from "./transport";

const STAGE: Stage = {
  composition: () => "main",
  fps: () => 30,
  frame: () => 12,
  video: () => ({ durationInFrames: 90, fps: 30, height: 1080, width: 1920 }),
};

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

afterEach(() => {
  armInspect(false, STAGE);
  armSnapshot(false, snapshotFrame);
});

const snapshotFrame = {
  composition: () => "main",
  frame: () => 12,
  height: () => 1080,
  width: () => 1920,
};

function staged(): HTMLElement {
  const canvas = document.createElement("div");
  canvas.className = "__remotion-player";
  surface.root.append(canvas);
  return canvas;
}

async function decodedSent(type: MessageType): Promise<unknown[]> {
  await act(() => surface.flush());
  const found = surface.sent.filter((message) => message.type === type);
  expect(found.length).toBeGreaterThan(0);
  return found.map((message) => {
    const decoded = decodePreviewMessage({
      ...message,
      source: "remocn-preview",
    });
    if (Exit.isFailure(decoded)) {
      throw new Error(`${type} did not decode: ${String(decoded.cause)}`);
    }
    return decoded.value;
  });
}

function press(target: Element, type: "pointerdown" | "pointerup") {
  surface.pointAt([target]);
  surface.viewport.dispatchEvent(
    new PointerEvent(type, {
      altKey: true,
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    })
  );
}

function player(): PlayerRef {
  const fake = {
    addEventListener: () => undefined,
    getCurrentFrame: () => 12,
    getVolume: () => 0.5,
    isMuted: () => false,
    isPlaying: () => false,
    mute: () => undefined,
    pause: () => undefined,
    play: () => undefined,
    removeEventListener: () => undefined,
    seekTo: () => undefined,
    setVolume: () => undefined,
    unmute: () => undefined,
  };
  return fake as unknown as PlayerRef;
}

describe("what the preview sends, read by the studio", () => {
  it("a picked element's selection", async () => {
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ files: ["logo.png"] })
    );
    const canvas = staged();
    const inside = document.createElement("span");
    inside.textContent = "Hello";
    canvas.append(inside);
    armInspect(true, STAGE);

    press(inside, "pointerdown");
    await waitFor(() =>
      expect(surface.sent.some((message) => message.type === "selection")).toBe(
        true
      )
    );

    const [selection] = await decodedSent("selection");
    expect(selection).toMatchObject({ element: { frame: 12 } });
    fetched.mockRestore();
  });

  it("a managed object's selection", async () => {
    const canvas = staged();
    const object = document.createElement("h1");
    object.textContent = "Title";
    object.setAttribute("data-studio-object", "title");
    object.setAttribute("data-studio-generation", "generation-1");
    object.setAttribute("data-studio-video", "intro");
    canvas.append(object);
    armInspect(true, STAGE);

    press(object, "pointerdown");

    expect(await decodedSent("studio.select")).toEqual([
      {
        generation: "generation-1",
        objectId: "title",
        source: "remocn-preview",
        type: "studio.select",
        video: "intro",
      },
    ]);
  });

  it("the geometry editor asking for its configuration", async () => {
    staged();
    armInspect(true, STAGE);

    expect(await decodedSent("studio.geometry.request")).toHaveLength(1);
  });

  it("a snapshot click's capture, and Escape's clear", async () => {
    const canvas = staged();
    armSnapshot(true, snapshotFrame);

    press(canvas, "pointerdown");
    press(canvas, "pointerup");
    surface.viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      })
    );

    expect(await decodedSent("capture")).toEqual([
      {
        composition: "main",
        frame: 12,
        rect: null,
        source: "remocn-preview",
        type: "capture",
      },
    ]);
    expect(await decodedSent("inspect.clear")).toHaveLength(1);
  });

  it("the transport's state and playhead", async () => {
    const ref = { current: player() };
    renderHook(() => usePlayerTransport(ref, "intro", 300, () => undefined));

    surface.send({ type: "transport.request" });

    expect(await decodedSent("transport.state")).toContainEqual(
      expect.objectContaining({ compositionId: "intro", volume: 0.5 })
    );
    expect(await decodedSent("playhead")).toEqual([
      { frame: 12, playing: false, source: "remocn-preview", type: "playhead" },
    ]);
  });

  it("the scenes the Player registered", async () => {
    const { result } = renderHook(() => useSceneObserver("intro", 300));
    const scene = (id: string, from: number, duration: number) => ({
      displayName: id,
      duration,
      from,
      id,
      parent: null,
      showInTimeline: true,
      type: "sequence",
    });
    act(() =>
      result.current([scene("Intro", 0, 100), scene("Outro", 100, 200)])
    );
    await waitFor(() => expect(surface.sent).toHaveLength(1));

    expect(await decodedSent("scenes")).toHaveLength(1);
  });

  it("the composition report", async () => {
    const component = () => null;
    const compositions = [
      {
        component,
        durationInFrames: 300,
        fps: 30,
        height: 1080,
        id: "Main",
        width: 1920,
      },
    ];
    const picked = pick(compositions, null, null);
    post(
      describeComposition(
        picked,
        {
          message: null,
          metadata: {
            component,
            defaultProps: {},
            durationInFrames: 300,
            fps: 30,
            height: 1080,
            props: {},
            width: 1920,
          },
          state: "ready",
        },
        ["Main"]
      )
    );
    post(
      describeComposition(
        null,
        { message: null, metadata: null, state: "loading" },
        []
      )
    );

    expect(await decodedSent("composition")).toHaveLength(2);
  });

  it("the managed objects present on screen", async () => {
    const object = document.createElement("div");
    object.setAttribute("data-studio-object", "title");
    surface.root.append(object);

    const stop = watchPresence(surface.root, (ids) =>
      post({ ids, type: "studio.present" })
    );
    stop();

    expect(await decodedSent("studio.present")).toEqual([
      { ids: ["title"], source: "remocn-preview", type: "studio.present" },
    ]);
  });
});
