import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type ExportSettings, useExport } from "@/hooks/use-export";
import type { ExportEvent, Exported } from "@/shared/ipc";

const PROJECT = "project-1";
const OTHER = "project-2";
const OUTPUT = "/Users/me/scenes/out/Main.mp4";

const SERVING: ExportSettings = {
  composition: "Main",
  isServing: true,
  projectId: PROJECT,
};

const EXPORTED: Exported = { bytes: 4_404_019, path: OUTPUT };

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

function mockExport() {
  const state = {
    cancels: 0,
    index: 0,
    requests: 0,
    revealed: [] as string[],
  };

  let settle: ((exported: Exported) => void) | null = null;
  let breaks: ((message: string) => void) | null = null;
  let stream = 0;

  mockIPC((cmd, args) => {
    if (cmd === "sidecar_request") {
      const payload = args as Record<string, unknown>;
      stream = (payload.onStream as { id: number }).id;
      state.requests += 1;

      return new Promise<Exported>((resolve, reject) => {
        settle = resolve;
        breaks = (message) => reject(new Error(message));
      });
    }

    if (cmd === "sidecar_cancel") {
      state.cancels += 1;
      return null;
    }

    if (cmd === "plugin:opener|reveal_item_in_dir") {
      state.revealed.push(String((args as { paths: string[] }).paths[0]));
      return null;
    }

    throw new Error(`unexpected command: ${cmd}`);
  });

  return {
    finish: async (exported: Exported = EXPORTED) => {
      await act(async () => {
        settle?.(exported);
        await Promise.resolve();
      });
    },
    send: (event: ExportEvent) => {
      act(() => {
        internals().runCallback(stream, { index: state.index, message: event });
        state.index += 1;
      });
    },
    spoil: async (message: string) => {
      await act(async () => {
        breaks?.(message);
        await Promise.resolve();
      });
    },
    state,
  };
}

async function started(settings: ExportSettings = SERVING) {
  const host = mockExport();
  const rendered = renderHook((props: ExportSettings) => useExport(props), {
    initialProps: settings,
  });

  act(() => {
    rendered.result.current.start();
  });

  await waitFor(() => {
    expect(rendered.result.current.isRunning).toBe(true);
  });

  return { host, rendered };
}

describe("useExport", () => {
  it("refuses to export a preview that is not serving", () => {
    const { result } = renderHook(() =>
      useExport({ ...SERVING, isServing: false })
    );

    expect(result.current.canExport).toBe(false);
    expect(result.current.unavailable).toBe(
      "The preview has to be running before it can be exported."
    );
  });

  it("refuses to export a project that is not open", () => {
    const { result } = renderHook(() =>
      useExport({ composition: null, isServing: false, projectId: null })
    );

    expect(result.current.unavailable).toBe("Open a project to export it.");
  });

  it("says what it is doing while the frames render", async () => {
    const { host, rendered } = await started();

    host.send({
      encoded: 40,
      percent: 21,
      rendered: 64,
      stage: "encoding",
      total: 300,
      type: "progress",
    });

    expect(rendered.result.current.status).toBe(
      "Rendering — 64/300 frames · 21%"
    );
    expect(rendered.result.current.percent).toBe(21);
  });

  it("shows the finished file and reveals it in Finder", async () => {
    const { host, rendered } = await started();

    await host.finish();

    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    expect(rendered.result.current.isRunning).toBe(false);
    expect(rendered.result.current.status).toBeNull();
    expect(host.state.revealed).toEqual([OUTPUT]);
  });

  it("cancels the request it started, and reports no error for it", async () => {
    const { host, rendered } = await started();

    act(() => {
      rendered.result.current.cancel();
    });

    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(false);
    });

    expect(host.state.cancels).toBe(1);
    expect(rendered.result.current.trouble).toBeNull();
    expect(rendered.result.current.result).toBeNull();
  });

  it("surfaces why a render failed", async () => {
    const { host, rendered } = await started();

    await host.spoil("Cannot find module ./missing");

    await waitFor(() => {
      expect(rendered.result.current.trouble).toBe(
        "Cannot find module ./missing"
      );
    });

    expect(rendered.result.current.isRunning).toBe(false);
  });

  it("starts one export at a time", async () => {
    const { host, rendered } = await started();

    act(() => {
      rendered.result.current.start();
    });

    expect(host.state.requests).toBe(1);
  });

  it("says why another project's export blocks this one", async () => {
    const { rendered } = await started();

    rendered.rerender({ ...SERVING, projectId: OTHER });

    expect(rendered.result.current.isRunning).toBe(false);
    expect(rendered.result.current.canExport).toBe(false);
    expect(rendered.result.current.unavailable).toBe(
      "Another project is exporting, and only one export runs at a time."
    );
  });

  it("keeps showing a render that is still running when you come back to it", async () => {
    const { rendered } = await started();

    rendered.rerender({ ...SERVING, projectId: OTHER });
    rendered.rerender(SERVING);

    expect(rendered.result.current.isRunning).toBe(true);
  });

  it("does not show one project's finished file against another", async () => {
    const { host, rendered } = await started();

    await host.finish();

    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    rendered.rerender({ ...SERVING, projectId: OTHER });

    expect(rendered.result.current.result).toBeNull();
  });
});
