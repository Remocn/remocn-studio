import { describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MouseEvent } from "react";
import { isSettingUp, useScaffold } from "@/hooks/use-scaffold";
import type { Project } from "@/shared/ipc";

const PROJECT = "project-1";

function clickFor(value: string) {
  return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
}

function hangingScaffold() {
  const state = { cancels: 0, requests: 0 };
  mockIPC((cmd) => {
    if (cmd === "sidecar_request") {
      state.requests += 1;
      return new Promise(() => undefined);
    }
    if (cmd === "sidecar_cancel") {
      state.cancels += 1;
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return state;
}

// The scaffold answers when the template is copied and the install is done;
// `land` is that answer, held back until the test says so.
interface Landing {
  land: (project: Project) => void;
}

function landingScaffold(): Landing {
  const state: Landing = { land: () => undefined };
  mockIPC((cmd) => {
    if (cmd === "sidecar_request") {
      return new Promise<Project>((resolve) => {
        state.land = resolve;
      });
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return state;
}

const SCAFFOLDED: Project = {
  createdAt: 1_700_000_000_000,
  id: PROJECT,
  missing: false,
  name: "My video",
  path: "/home/me/projects/my-video",
  updatedAt: 1_700_000_000_000,
};

describe("isSettingUp", () => {
  it("holds a project while its scaffold runs and lets go once it lands", async () => {
    const host = landingScaffold();
    const onScaffolded = mock();
    const { result } = renderHook(() => useScaffold(onScaffolded));

    expect(isSettingUp(result.current.scaffolds, PROJECT)).toBe(false);
    act(() => {
      result.current.startScaffold(PROJECT);
    });
    expect(isSettingUp(result.current.scaffolds, PROJECT)).toBe(true);

    await act(async () => {
      host.land(SCAFFOLDED);
      await Promise.resolve();
    });

    await waitFor(() => expect(onScaffolded).toHaveBeenCalledTimes(1));
    expect(isSettingUp(result.current.scaffolds, PROJECT)).toBe(false);
  });

  it("lets go of a cancelled scaffold, so the folder can be read for what it lacks", async () => {
    const host = hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    act(() => {
      result.current.startScaffold(PROJECT);
    });
    await waitFor(() => expect(host.requests).toBe(1));
    act(() => {
      result.current.onCancelScaffold(clickFor(PROJECT));
    });

    await waitFor(() =>
      expect(isSettingUp(result.current.scaffolds, PROJECT)).toBe(false)
    );
  });

  it("holds nothing for no project, or for one that is not being set up", () => {
    hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    act(() => {
      result.current.startScaffold(PROJECT);
    });

    expect(isSettingUp(result.current.scaffolds, null)).toBe(false);
    expect(isSettingUp(result.current.scaffolds, "project-2")).toBe(false);
  });
});

describe("useScaffold", () => {
  it("records when the running step started, for the elapsed time", () => {
    hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    const before = Date.now();
    act(() => {
      result.current.startScaffold(PROJECT);
    });

    const scaffold = result.current.scaffolds.get(PROJECT);
    expect(scaffold?.isRunning).toBe(true);
    expect(scaffold?.startedAt).toBeGreaterThanOrEqual(before);
  });

  it("cancels a running scaffold and says so rather than failing", async () => {
    const host = hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    act(() => {
      result.current.startScaffold(PROJECT);
    });
    await waitFor(() => expect(host.requests).toBe(1));

    act(() => {
      result.current.onCancelScaffold(clickFor(PROJECT));
    });

    await waitFor(() => {
      expect(result.current.scaffolds.get(PROJECT)?.isRunning).toBe(false);
    });
    const scaffold = result.current.scaffolds.get(PROJECT);
    expect(scaffold?.cancelled).toBe(true);
    expect(scaffold?.error).toBeNull();
    await waitFor(() => expect(host.cancels).toBe(1));
  });
});
