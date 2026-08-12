"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type PaneView,
  type SlideDirection,
  slideDirection,
} from "@/lib/studio/pane-view";
import { showsPreview } from "@/lib/studio/panes";
import {
  type StudioSettings,
  savePaneView,
  savePreviewPane,
  saveProjectsPane,
} from "@/lib/studio/settings";

export interface Panes {
  isPreviewShown: boolean;
  isProjectsShown: boolean;
  paneSlide: SlideDirection;
  paneView: PaneView;
  showPane: (view: PaneView) => void;
  togglePreview: () => void;
  toggleProjects: () => void;
}

export function usePanes(
  settings: StudioSettings | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): Panes {
  const [preview, setPreview] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<boolean | null>(null);
  const [view, setView] = useState<PaneView | null>(null);
  const cameFrom = useRef<PaneView | null>(null);

  const isPreviewShown = showsPreview(
    preview ?? settings?.previewPane ?? null,
    hasProjects,
    isLoadingProjects
  );
  const isProjectsShown = projects ?? settings?.projectsPane ?? true;

  const togglePreview = useCallback(() => {
    const next = !isPreviewShown;
    setPreview(next);
    Effect.runFork(savePreviewPane(next));
  }, [isPreviewShown]);

  const toggleProjects = useCallback(() => {
    const next = !isProjectsShown;
    setProjects(next);
    Effect.runFork(saveProjectsPane(next));
  }, [isProjectsShown]);

  const paneView = view ?? settings?.paneView ?? "projects";
  const held = useRef(paneView);
  held.current = paneView;

  const showPane = useCallback((next: PaneView) => {
    if (next === held.current) {
      return;
    }
    cameFrom.current = held.current;
    setView(next);
    Effect.runFork(savePaneView(next));
  }, []);

  const paneSlide = slideDirection(cameFrom.current, paneView);

  return useMemo(
    () => ({
      isPreviewShown,
      isProjectsShown,
      paneSlide,
      paneView,
      showPane,
      togglePreview,
      toggleProjects,
    }),
    [
      isPreviewShown,
      isProjectsShown,
      paneSlide,
      paneView,
      showPane,
      togglePreview,
      toggleProjects,
    ]
  );
}
