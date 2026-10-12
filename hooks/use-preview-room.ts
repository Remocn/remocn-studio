"use client";

import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels";
import { previewRoom } from "@/lib/studio/panes";

export interface PreviewRoom {
  groupRef: RefObject<HTMLDivElement | null>;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
}

function panesWidth(group: HTMLElement): number {
  let width = 0;
  for (const child of group.children) {
    if (child instanceof HTMLElement && child.hasAttribute("data-panel")) {
      width += child.offsetWidth;
    }
  }
  return width;
}

// The chat keeps its pixels when the group changes size, so opening the
// preview, opening the sidebar or narrowing the window used to come out of the
// preview — and the inspector inside it — until the canvas was a sliver. The
// chat yields first instead, down to its own minimum; nothing is hidden to make
// room. Only a drag of the divider holds the preview narrower than its room.
export function usePreviewRoom({
  isShown,
  isSliding,
  onLayoutChanged,
  panelRef,
}: {
  isShown: boolean;
  isSliding: boolean;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  panelRef: RefObject<PanelImperativeHandle | null>;
}): PreviewRoom {
  const groupRef = useRef<HTMLDivElement | null>(null);

  // The size is read as the group's share, not the panel's own pixels: right
  // after `expand()` the layout is new and the DOM has not caught up with it.
  const makeRoom = useCallback(() => {
    const panel = panelRef.current;
    const group = groupRef.current;

    if (panel === null || group === null) {
      return;
    }

    if (panel.isCollapsed()) {
      panel.expand();
      return;
    }

    const width = panesWidth(group);
    const target = previewRoom(
      (panel.getSize().asPercentage / 100) * width,
      width
    );

    if (target !== null) {
      panel.resize(`${target}px`);
    }
  }, [panelRef]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!isShown || isSliding || group === null) {
      return;
    }

    makeRoom();
    const observer = new ResizeObserver(makeRoom);
    observer.observe(group);
    return () => observer.disconnect();
  }, [isShown, isSliding, makeRoom]);

  const onChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      onLayoutChanged(layout, meta);

      if (isShown && !isSliding && !meta.isUserInteraction) {
        makeRoom();
      }
    },
    [isShown, isSliding, makeRoom, onLayoutChanged]
  );

  return { groupRef, onLayoutChanged: onChanged };
}
