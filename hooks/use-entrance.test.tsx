import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEntrance } from "@/hooks/use-entrance";

describe("useEntrance", () => {
  it("plays nothing on the first paint, whichever screen that is", () => {
    expect(renderHook(() => useEntrance(false)).result.current).toBeNull();
    expect(renderHook(() => useEntrance(true)).result.current).toBeNull();
  });

  it("moves forward on the way in and back on the way out", () => {
    const { rerender, result } = renderHook(
      ({ isAhead }) => useEntrance(isAhead),
      { initialProps: { isAhead: false } }
    );

    rerender({ isAhead: true });
    expect(result.current).toBe("animate-screen-in");

    rerender({ isAhead: false });
    expect(result.current).toBe("animate-screen-back");
  });

  it("keeps the direction while the screen it belongs to stays put", () => {
    const { rerender, result } = renderHook(
      ({ isAhead }) => useEntrance(isAhead),
      { initialProps: { isAhead: false } }
    );

    rerender({ isAhead: true });
    rerender({ isAhead: true });

    expect(result.current).toBe("animate-screen-in");
  });
});
