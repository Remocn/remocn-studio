import { beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type TestSurface, withSurface } from "@/test/surface";
import type { RegisteredSequence } from "./scenes";
import { useSceneObserver } from "./scenes-report";

function sequence(
  id: string,
  from: number,
  duration: number
): RegisteredSequence {
  return {
    displayName: id,
    duration,
    from,
    id,
    parent: null,
    showInTimeline: true,
    type: "sequence",
  };
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

describe("useSceneObserver", () => {
  it("posts the scenes the Player registered, once per frame", async () => {
    const { result } = renderHook(() => useSceneObserver("intro", 300));
    act(() => {
      result.current([sequence("Intro", 0, 100)]);
      result.current([sequence("Intro", 0, 100), sequence("Outro", 100, 200)]);
    });

    await waitFor(() => expect(surface.sent).toHaveLength(1));
    expect(surface.sent[0]).toMatchObject({
      compositionId: "intro",
      scenes: [{ name: "Intro" }, { name: "Outro" }],
      type: "scenes",
    });
  });

  it("stays quiet when the registry changes but the scenes do not", async () => {
    const scenes = [sequence("Intro", 0, 100), sequence("Outro", 100, 200)];
    const { result } = renderHook(() => useSceneObserver("intro", 300));
    act(() => result.current(scenes));
    await waitFor(() => expect(surface.sent).toHaveLength(1));

    act(() =>
      result.current([
        ...scenes,
        { ...sequence("Word", 10, 5), parent: "Intro" },
      ])
    );
    await frame();
    await frame();

    expect(surface.sent).toHaveLength(1);
  });

  it("posts again when a rebuild retimes a scene", async () => {
    const { result } = renderHook(() => useSceneObserver("intro", 300));
    act(() =>
      result.current([sequence("Intro", 0, 100), sequence("Outro", 100, 200)])
    );
    await waitFor(() => expect(surface.sent).toHaveLength(1));

    act(() =>
      result.current([sequence("Intro", 0, 120), sequence("Outro", 120, 180)])
    );

    await waitFor(() => expect(surface.sent).toHaveLength(2));
  });
});
