import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { usePreviewCollapse } from "@/hooks/use-preview-collapse";

const USER = { isUserInteraction: true };
const AUTOMATIC = { isUserInteraction: false };

function panel(isCollapsed: boolean): PanelImperativeHandle {
  return {
    collapse: mock(),
    expand: mock(),
    getSize: () => ({ asPercentage: 0, inPixels: 0 }),
    isCollapsed: () => isCollapsed,
    resize: mock(),
  };
}

function mounted(isShown: boolean, collapsed: boolean) {
  const onCollapsed = mock();
  const view = renderHook(() => usePreviewCollapse(isShown, onCollapsed));
  view.result.current.panelRef.current = panel(collapsed);
  return { onCollapsed, view };
}

describe("usePreviewCollapse", () => {
  // Dragging the divider past the preview's own minSize collapses the panel
  // inside react-resizable-panels, which is not the app's `isPreviewShown` —
  // and the header renders the way back off the latter. Left as two states the
  // drag took the preview and every control that could restore it.
  it("folds a collapse the group reports into the app's own flag", () => {
    const { onCollapsed, view } = mounted(true, true);

    act(() => view.result.current.onLayoutChanged({}, USER));

    expect(onCollapsed).toHaveBeenCalledTimes(1);
  });

  it("says nothing while the panel is merely narrow", () => {
    const { onCollapsed, view } = mounted(true, false);

    act(() => view.result.current.onLayoutChanged({}, USER));

    expect(onCollapsed).not.toHaveBeenCalled();
  });

  // Hiding the preview collapses the panel ourselves, so the report that comes
  // back is our own instruction echoing — acting on it would fight the toggle.
  it("ignores the collapse it asked for itself", () => {
    const { onCollapsed, view } = mounted(false, true);

    act(() => view.result.current.onLayoutChanged({}, USER));

    expect(onCollapsed).not.toHaveBeenCalled();
  });

  it("survives a resize reported before the panel has a handle", () => {
    const onCollapsed = mock();
    const view = renderHook(() => usePreviewCollapse(true, onCollapsed));

    expect(() =>
      act(() => view.result.current.onLayoutChanged({}, USER))
    ).not.toThrow();
    expect(onCollapsed).not.toHaveBeenCalled();
  });

  it("keeps the requested preview open during automatic sidebar sizing", () => {
    const { onCollapsed, view } = mounted(true, true);

    act(() => view.result.current.onLayoutChanged({}, AUTOMATIC));

    expect(onCollapsed).not.toHaveBeenCalled();
  });
});
