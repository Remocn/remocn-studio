import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useWindowControls } from "@/hooks/use-window-controls";

const runtime = globalThis as typeof globalThis & { isTauri?: boolean };
let original: boolean | undefined;

beforeEach(() => {
  original = runtime.isTauri;
  runtime.isTauri = true;
  mockWindows("main");
});

afterEach(() => {
  runtime.isTauri = original;
});

describe("useWindowControls", () => {
  it("sends each control's own window command", async () => {
    const seen: string[] = [];
    mockIPC((command) => {
      if (command.startsWith("plugin:window|")) {
        seen.push(command);
      }
    });
    const { result } = renderHook(() => useWindowControls());

    result.current.onClose();
    result.current.onMinimize();
    result.current.onToggleMaximize();

    await waitFor(() =>
      expect(seen.toSorted((a, b) => a.localeCompare(b))).toEqual([
        "plugin:window|close",
        "plugin:window|minimize",
        "plugin:window|toggle_maximize",
      ])
    );
  });

  it("swallows a window manager that refuses", async () => {
    let asked = 0;
    mockIPC((command) => {
      if (command === "plugin:window|minimize") {
        asked += 1;
        throw new Error("not supported by this window manager");
      }
    });
    const { result } = renderHook(() => useWindowControls());

    expect(() => result.current.onMinimize()).not.toThrow();
    await waitFor(() => expect(asked).toBe(1));
  });
});
