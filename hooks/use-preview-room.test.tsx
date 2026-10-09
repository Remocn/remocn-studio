import { describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { usePreviewRoom } from "@/hooks/use-preview-room";
import { CHAT_MIN_WIDTH, PREVIEW_ROOM } from "@/lib/studio/panes";

const USER = { isUserInteraction: true };
const LIBRARY = { isUserInteraction: false };

function group(chat: number, preview: number): HTMLDivElement {
  const element = document.createElement("div");
  for (const width of [chat, 1, preview]) {
    const child = document.createElement("div");
    if (width !== 1) {
      child.setAttribute("data-panel", "");
    }
    Object.defineProperty(child, "offsetWidth", { value: width });
    element.append(child);
  }
  return element;
}

function panel(share: number, collapsed = false) {
  const handle = {
    collapse: mock(),
    expand: mock(),
    getSize: () => ({ asPercentage: share, inPixels: 0 }),
    isCollapsed: () => collapsed,
    resize: mock(),
  } satisfies PanelImperativeHandle;
  return handle;
}

function mounted({
  isShown = true,
  isSliding = false,
  preview,
  width,
}: {
  isShown?: boolean;
  isSliding?: boolean;
  preview: ReturnType<typeof panel>;
  width: number;
}) {
  const save = mock();
  const panelRef = { current: preview };
  const view = renderHook(
    (props: { isShown: boolean; isSliding: boolean }) => {
      const room = usePreviewRoom({
        ...props,
        onLayoutChanged: save,
        panelRef,
      });
      room.groupRef.current ??= group(width / 2, width / 2);
      return room;
    },
    { initialProps: { isShown, isSliding } }
  );
  return { save, view };
}

describe("usePreviewRoom", () => {
  // The screenshot this answers: at the default window the stored split left
  // the preview 502px, 340 of them the inspector's.
  it("narrows the chat when the preview is shown squeezed", () => {
    const preview = panel(44);

    mounted({ preview, width: 1142 });

    expect(preview.resize).toHaveBeenCalledWith(`${1142 - CHAT_MIN_WIDTH}px`);
  });

  it("gives the preview its room when the chat has more to give", () => {
    const preview = panel(30);

    mounted({ preview, width: 1422 });

    expect(preview.resize).toHaveBeenCalledWith(`${PREVIEW_ROOM}px`);
  });

  it("leaves a preview that already has its room", () => {
    const preview = panel(70);

    mounted({ preview, width: 1422 });

    expect(preview.resize).not.toHaveBeenCalled();
  });

  // Nothing is hidden or shown to make room: a hidden preview stays hidden.
  it("does nothing while the preview is hidden", () => {
    const preview = panel(0, true);

    const { view } = mounted({ isShown: false, preview, width: 1142 });
    view.result.current.onLayoutChanged({}, LIBRARY);

    expect(preview.resize).not.toHaveBeenCalled();
    expect(preview.expand).not.toHaveBeenCalled();
  });

  it("reopens a requested preview after the group temporarily collapsed it", () => {
    const preview = panel(0, true);

    mounted({ preview, width: 1024 });

    expect(preview.expand).toHaveBeenCalledTimes(1);
  });

  it("waits for the sidebar to settle, then makes room once", () => {
    const preview = panel(44);
    const { view } = mounted({ isSliding: true, preview, width: 1142 });

    view.result.current.onLayoutChanged({}, LIBRARY);
    expect(preview.resize).not.toHaveBeenCalled();

    view.rerender({ isShown: true, isSliding: false });
    expect(preview.resize).toHaveBeenCalledTimes(1);
  });

  it("makes room after a change the person did not make with the divider", () => {
    const preview = panel(70);
    const { view } = mounted({ preview, width: 1422 });
    preview.getSize = () => ({ asPercentage: 30, inPixels: 0 });

    view.result.current.onLayoutChanged({}, LIBRARY);

    expect(preview.resize).toHaveBeenCalledWith(`${PREVIEW_ROOM}px`);
  });

  // A drag is the person's own choice of width, down to the preview's minimum.
  it("keeps the width the divider was dropped at", () => {
    const preview = panel(70);
    const { save, view } = mounted({ preview, width: 1422 });
    preview.getSize = () => ({ asPercentage: 30, inPixels: 0 });

    view.result.current.onLayoutChanged({ chat: 70, preview: 30 }, USER);

    expect(preview.resize).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({ chat: 70, preview: 30 }, USER);
  });

  it("still hands every change to the stored layout", () => {
    const preview = panel(70);
    const { save, view } = mounted({ preview, width: 1422 });

    view.result.current.onLayoutChanged({ chat: 30, preview: 70 }, LIBRARY);

    expect(save).toHaveBeenCalledWith({ chat: 30, preview: 70 }, LIBRARY);
  });

  it("does nothing before the group has a width", () => {
    const preview = panel(44);

    mounted({ preview, width: 0 });

    expect(preview.resize).not.toHaveBeenCalled();
  });
});
