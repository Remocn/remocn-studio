import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";

const asset: Asset = {
  audiomap: null,
  category: "Captions",
  clip: "/caption/preview.mp4",
  createdAt: 0,
  dependencies: [],
  description: "",
  duration: null,
  files: [],
  name: "Karaoke",
  path: "/caption",
  preview: "/caption/poster.png",
  proxied: false,
  role: null,
  slug: "remocn/caption-karaoke",
  source: null,
  type: "component",
};
const originalMatchMedia = window.matchMedia;
let play: ReturnType<typeof spyOn<HTMLMediaElement, "play">>;
let pause: ReturnType<typeof spyOn<HTMLMediaElement, "pause">>;
beforeEach(() => {
  mockIPC(() => null);
  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };
  internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
    `asset://localhost${path}`;
  play = spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
    () => undefined
  );
});
afterEach(() => {
  play.mockRestore();
  pause.mockRestore();
  window.matchMedia = originalMatchMedia;
});

it("opens a muted looping preview after keyboard focus and keeps selection independent", async () => {
  const pick = mock();
  const { unmount } = render(<AssetGrid assets={[asset]} onPick={pick} />);
  const card = screen.getByRole("button", { name: "Karaoke, Component" });
  act(() => card.focus());
  expect(document.querySelector("video")).toBeNull();
  await waitFor(() => expect(document.querySelector("video")).not.toBeNull());
  const video = document.querySelector("video");
  expect(video?.loop).toBe(true);
  expect(video?.muted).toBe(true);
  expect(play).toHaveBeenCalled();
  expect(pick).not.toHaveBeenCalled();
  fireEvent.click(card);
  expect(pick).toHaveBeenCalledTimes(1);
  unmount();
  expect(pause).toHaveBeenCalled();
});

it("keeps the poster until explicit playback under reduced motion and falls back on error", async () => {
  window.matchMedia = ((query: string) => ({
    addEventListener: mock(),
    matches: query.includes("prefers-reduced-motion"),
    removeEventListener: mock(),
  })) as unknown as typeof window.matchMedia;
  render(<AssetGrid assets={[asset]} onPick={mock()} />);
  act(() => screen.getByRole("button", { name: "Karaoke, Component" }).focus());
  const start = await screen.findByRole("button", { name: "Play preview" });
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(start);
  expect(play).toHaveBeenCalled();
  const video = document.querySelector("video");
  expect(video).not.toBeNull();
  if (video) {
    fireEvent.error(video);
  }
  expect(document.querySelector("video")).toBeNull();
  expect(
    document.querySelector('[data-slot="hover-card-content"] img')
  ).not.toBeNull();
});
