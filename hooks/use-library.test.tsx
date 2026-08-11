import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLibrary } from "@/hooks/use-library";
import type { Asset } from "@/shared/library";

const STILL = "/pasted/frame.png";

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    createdAt: 1,
    dependencies: [],
    description: "",
    duration: null,
    files: ["intro.mp4"],
    name: "Intro",
    path: "/library/assets/intro",
    preview: null,
    slug: "intro",
    type: "video",
    ...shape,
  };
}

interface Calls {
  decoded: string[];
  previewed: { path: string; slug: string }[];
}

// The whole point of the backfill is that a frame is decoded once, so the fake
// counts decodes rather than pretending they are free.
function install(assets: readonly Asset[]): Calls {
  const calls: Calls = { decoded: [], previewed: [] };

  mockIPC((cmd, payload) => {
    if (cmd === "sidecar_request") {
      const { method, params } = payload as {
        method: string;
        params: Record<string, string>;
      };

      if (method === "library.list") {
        return assets;
      }
      if (method === "library.preview") {
        calls.previewed.push({ path: params.path, slug: params.slug });
        return { ...asset(), preview: "/library/assets/intro/preview.png" };
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
});
