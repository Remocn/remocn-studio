import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLibrary } from "@/hooks/use-library";
import type { Asset } from "@/shared/library";

const STILL = "/pasted/frame.png";
const WINDOW = "40 millis";
const PAST_WINDOW = 120;

function click(slug: string) {
  return {
    currentTarget: { value: slug },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

function pause(ms: number) {
  return act(
    () =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
  );
}

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    category: null,
    clip: null,
    createdAt: 1,
    dependencies: [],
    description: "",
    duration: null,
    files: ["intro.mp4"],
    name: "Intro",
    path: "/library/assets/intro",
    preview: null,
    proxied: true,
    role: null,
    slug: "intro",
    type: "video",
    ...shape,
  };
}

interface Calls {
  decoded: string[];
  list: (next: readonly Asset[]) => void;
  previewed: { path: string; slug: string }[];
  removed: string[];
}

// The whole point of the backfill is that a frame is decoded once, so the fake
// counts decodes rather than pretending they are free. The listing is mutable,
// because the agent can write to the library while the app is running.
function install(assets: readonly Asset[]): Calls {
  let listing = assets;
  const calls: Calls = {
    decoded: [],
    list: (next) => {
      listing = next;
    },
    previewed: [],
    removed: [],
  };

  mockIPC((cmd, payload) => {
    if (cmd === "sidecar_request") {
      const { method, params } = payload as {
        method: string;
        params: Record<string, string>;
      };

      if (method === "library.list") {
        return listing;
      }
      if (method === "library.preview") {
        calls.previewed.push({ path: params.path, slug: params.slug });
        return { ...asset(), preview: "/library/assets/intro/preview.png" };
      }
      if (method === "library.remove") {
        calls.removed.push(params.slug);
        return { removed: true };
      }
    }

    if (cmd === "save_pasted_image") {
      return STILL;
    }
  });

  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };
  internals.__TAURI_INTERNALS__.convertFileSrc = (path) => {
    calls.decoded.push(path);
    return `asset://localhost/${encodeURIComponent(path)}`;
  };

  return calls;
}

describe("useLibrary", () => {
  beforeEach(() => {
    clearMocks();
  });

  it("lists what the sidecar holds", async () => {
    install([asset({ preview: "/library/assets/intro/preview.png" })]);

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assets.map((row) => row.slug)).toEqual(["intro"]);
  });

  it("leaves a video that already has a still alone", async () => {
    const calls = install([
      asset({ preview: "/library/assets/intro/preview.png" }),
    ]);

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(calls.previewed).toEqual([]));
    expect(calls.decoded).toEqual([]);
  });

  it("never reaches for a still of a component or a picture", async () => {
    const calls = install([
      asset({ files: ["Neon.tsx"], slug: "neon", type: "component" }),
      asset({ files: ["logo.png"], slug: "logo", type: "img" }),
    ]);

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(calls.decoded).toEqual([]);
    expect(calls.previewed).toEqual([]);
  });

  it("reaches for a sound's waveform as readily as a video's frame", async () => {
    const calls = install([
      asset({
        files: ["theme.wav"],
        path: "/library/assets/theme",
        slug: "theme",
        type: "audio",
      }),
    ]);

    const { result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(calls.decoded).toEqual(["/library/assets/theme/theme.wav"])
    );
  });

  it("tries a video with no still exactly once, however often it is listed", async () => {
    const calls = install([asset()]);

    const { rerender, result } = renderHook(() => useLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(calls.decoded).toEqual(["/library/assets/intro/intro.mp4"])
    );

    rerender();
    result.current.reload();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A clip whose frame will not decode must not be retried on every listing.
    expect(calls.decoded).toEqual(["/library/assets/intro/intro.mp4"]);
  });

  it("looks again when a turn settles, because the agent saves behind its back", async () => {
    const calls = install([]);

    const { rerender, result } = renderHook(
      ({ isRunning }: { isRunning: boolean }) => useLibrary(isRunning),
      { initialProps: { isRunning: true } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assets).toEqual([]);

    calls.list([
      asset({
        files: ["Neon.tsx"],
        name: "Neon",
        slug: "neon",
        type: "component",
      }),
    ]);
    rerender({ isRunning: false });

    await waitFor(() =>
      expect(result.current.assets.map((row) => row.slug)).toEqual(["neon"])
    );
    // Quiet: a skeleton after every turn would be a flicker reporting nothing.
    expect(result.current.isLoading).toBe(false);
  });

  it("takes the row away at once and the folder only once the window closes", async () => {
    const calls = install([asset({ preview: "/p.png" })]);

    const { result } = renderHook(() => useLibrary(false, WINDOW));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onRemove(click("intro")));

    expect(result.current.assets).toEqual([]);
    expect(calls.removed).toEqual([]);

    await pause(PAST_WINDOW);
    expect(calls.removed).toEqual(["intro"]);
  });

  it("puts an undone asset back where it was, and never deletes it", async () => {
    const calls = install([
      asset({ preview: "/a.png", slug: "one" }),
      asset({ preview: "/b.png", slug: "two" }),
      asset({ preview: "/c.png", slug: "three" }),
    ]);

    const { result } = renderHook(() => useLibrary(false, WINDOW));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onRemove(click("two")));
    act(() => result.current.undoRemove("two"));
    await pause(PAST_WINDOW);

    expect(result.current.assets.map((row) => row.slug)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(calls.removed).toEqual([]);
  });

  it("does not let a turn settling inside the window resurrect the row", async () => {
    const calls = install([asset({ preview: "/p.png" })]);

    const { rerender, result } = renderHook(
      ({ isRunning }: { isRunning: boolean }) => useLibrary(isRunning, WINDOW),
      { initialProps: { isRunning: true } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onRemove(click("intro")));
    // The asset is still on disk, so the listing this refresh takes has it.
    rerender({ isRunning: false });

    await waitFor(() => expect(calls.removed).toEqual(["intro"]));
    expect(result.current.assets).toEqual([]);
  });

  it("leaves the listing alone while a turn is still running", async () => {
    const calls = install([]);

    const { rerender, result } = renderHook(
      ({ isRunning }: { isRunning: boolean }) => useLibrary(isRunning),
      { initialProps: { isRunning: false } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    calls.list([asset({ slug: "neon", type: "component" })]);
    rerender({ isRunning: true });

    expect(result.current.assets).toEqual([]);
  });
});
