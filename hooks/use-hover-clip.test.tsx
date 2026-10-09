import { afterEach, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useClipFallback } from "./use-hover-clip";

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});
function mediaQuery(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    addEventListener: mock(),
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    removeEventListener: mock(),
  })) as unknown as typeof window.matchMedia;
}
it("mutes preview playback and stops it on close or detach", () => {
  mediaQuery(false);
  const video = document.createElement("video");
  video.play = mock(() => Promise.resolve());
  video.pause = mock();
  const { result } = renderHook(() => useClipFallback());
  act(() => result.current.ref(video));
  expect(video.muted).toBe(true);
  expect(video.play).toHaveBeenCalledTimes(1);
  act(() => result.current.onOpenChange(false));
  expect(video.pause).toHaveBeenCalled();
  act(() => result.current.ref(null));
  expect(video.pause).toHaveBeenCalledTimes(2);
});
it("waits for explicit playback with reduced motion and resets when closed", () => {
  mediaQuery(true);
  const video = document.createElement("video");
  video.play = mock(() => Promise.resolve());
  video.pause = mock();
  const { result } = renderHook(() => useClipFallback());
  act(() => result.current.ref(video));
  expect(video.play).not.toHaveBeenCalled();
  expect(result.current.isPlaying).toBe(false);
  act(() => result.current.play());
  act(() => result.current.ref(video));
  expect(video.play).toHaveBeenCalledTimes(1);
  act(() => result.current.onOpenChange(false));
  expect(result.current.isPlaying).toBe(false);
});
it("keeps a failed clip on its poster but ignores an interrupted play", async () => {
  mediaQuery(false);
  const video = document.createElement("video");
  video.pause = mock();
  video.play = mock(() =>
    Promise.reject(new DOMException("closed", "AbortError"))
  );
  const { result } = renderHook(() => useClipFallback());
  await act(async () => {
    result.current.ref(video);
    await Promise.resolve();
  });
  expect(result.current.isBroken).toBe(false);
  video.play = mock(() => Promise.reject(new Error("decode failed")));
  await act(async () => {
    result.current.ref(video);
    await Promise.resolve();
  });
  expect(result.current.isBroken).toBe(true);
});
