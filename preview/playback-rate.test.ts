import { beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { type TestSurface, withSurface } from "@/test/surface";
import { usePlaybackRate } from "./playback-rate";
import type { PreviewCommand } from "./protocol";

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

describe("usePlaybackRate", () => {
  it("plays at 1x until the pane asks for another speed", () => {
    const { result } = renderHook(() => usePlaybackRate());

    expect(result.current).toBe(1);

    act(() => surface.send({ rate: 0.25, type: "transport.rate" }));

    expect(result.current).toBe(0.25);
  });

  it("ignores a speed the panel does not offer", () => {
    const { result } = renderHook(() => usePlaybackRate());
    const offTheList = { rate: 3, type: "transport.rate" };
    act(() => surface.send(offTheList as unknown as PreviewCommand));

    expect(result.current).toBe(1);
  });
});
