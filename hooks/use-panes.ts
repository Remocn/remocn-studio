"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { showsPreview } from "@/lib/studio/panes";
import {
  type StudioSettings,
  saveAssetsDrawer,
  savePreviewPane,
  saveProjectsPane,
} from "@/lib/studio/settings";

export interface Panes {
  isAssetsOpen: boolean;
  isPreviewShown: boolean;
  isProjectsShown: boolean;
  toggleAssets: () => void;
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
  const [assets, setAssets] = useState<boolean | null>(null);

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

  const isAssetsOpen = assets ?? settings?.assetsDrawer ?? false;

  const toggleAssets = useCallback(() => {
    const next = !isAssetsOpen;
    setAssets(next);
    Effect.runFork(saveAssetsDrawer(next));
  }, [isAssetsOpen]);

  return useMemo(
    () => ({
      isAssetsOpen,
      isPreviewShown,
      isProjectsShown,
      toggleAssets,
      togglePreview,
      toggleProjects,
    }),
    [
      isAssetsOpen,
      isPreviewShown,
      isProjectsShown,
      toggleAssets,
      togglePreview,
      toggleProjects,
    ]
  );
}
