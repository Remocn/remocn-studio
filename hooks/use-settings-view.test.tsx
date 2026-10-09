import { afterEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useSettingsView } from "@/hooks/use-settings-view";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("settings navigation motion", () => {
  it("slides for pointer navigation and returns instantly with the keyboard", () => {
    const { result } = renderHook(() => useSettingsView());
    expect(result.current.animate).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.animate).toBe(true);

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    );
    expect(result.current.isOpen).toBe(false);
    expect(result.current.animate).toBe(false);

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.animate).toBe(false);
  });

  it("respects reduced motion even for pointer navigation", () => {
    window.matchMedia = (query) => ({
      ...originalMatchMedia(query),
      matches: query === "(prefers-reduced-motion: reduce)",
    });
    const { result } = renderHook(() => useSettingsView());
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.animate).toBe(false);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.animate).toBe(false);
  });
});
