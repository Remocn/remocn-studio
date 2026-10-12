"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels";

type Phase = "hidden" | "hiding" | "showing" | "shown";

const SETTLE_FALLBACK_MS = 400;

export interface PreviewCollapse {
  isAnimating: boolean;
  isMounted: boolean;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}

// A `collapsible` panel dragged past its own `minSize` collapses inside
// react-resizable-panels, and that is *not* the app's `isPreviewShown` — which
// is what the header renders its toggle off. Left as two states, one drag took
// the preview and every control that could bring it back, in a layout the
// studio then persisted. So a collapse the group reports folds into the one
// flag, and the toggle that already exists is the way back.
export function usePreviewCollapse(
  isShown: boolean,
  onCollapsed: () => void
): PreviewCollapse {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const [phase, setPhase] = useState<Phase>(isShown ? "shown" : "hidden");
  const previous = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const was = previous.current;
    previous.current = isShown;

    if (panel === null) {
      return;
    }

    if (was === null || was === isShown) {
      if (!isShown) {
        panel.collapse();
      }
      return;
    }

    setPhase(isShown ? "showing" : "hiding");
    if (isShown) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [isShown]);

  useEffect(() => {
    if (phase !== "hiding" && phase !== "showing") {
      return;
    }

    const timer = setTimeout(() => {
      setPhase((current) => {
        if (current === "hiding") {
          return "hidden";
        }

        return current === "showing" ? "shown" : current;
      });
    }, SETTLE_FALLBACK_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  // Automatic sizing can report zero while the sidebar gives the preview
  // room. Only a divider interaction means the person chose to hide it.
  const onLayoutChanged = useCallback(
    (_layout: Layout, meta: LayoutChangedMeta) => {
      if (
        meta.isUserInteraction &&
        isShown &&
        panelRef.current?.isCollapsed() === true
      ) {
        onCollapsed();
      }
    },
    [isShown, onCollapsed]
  );

  return {
    isAnimating: phase === "hiding" || phase === "showing",
    isMounted: phase !== "hidden",
    onLayoutChanged,
    panelRef,
  };
}
