import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useWindowBackground } from "@/hooks/use-window-background";

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

describe("useWindowBackground", () => {
  it("paints the window in the resolved theme's background", async () => {
    const seen: unknown[] = [];
    mockIPC((command, payload) => {
      if (command === "plugin:window|set_background_color") {
        seen.push((payload as { color: unknown }).color);
      }
    });
    const view = renderHook(({ theme }) => useWindowBackground(theme), {
      initialProps: { theme: undefined as string | undefined },
    });
    view.rerender({ theme: "system" });
    expect(seen).toEqual([]);
    view.rerender({ theme: "light" });
    await waitFor(() => expect(seen).toEqual(["#f5f5f5"]));
    view.rerender({ theme: "dark" });
    await waitFor(() => expect(seen).toEqual(["#f5f5f5", "#0a0a0a"]));
  });
});
