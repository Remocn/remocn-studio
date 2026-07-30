"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { type Inspection, useInspect } from "@/hooks/use-inspect";
import {
  type PreviewControl,
  useOnPreview,
  usePreview,
} from "@/hooks/use-preview";
import { type Snapshot, useSnapshot } from "@/hooks/use-snapshot";
import type { PreviewMessage } from "@/lib/studio/preview";

type Tool = "inspect" | "snapshot" | null;

export interface Tools {
  inspect: Inspection;
  preview: PreviewControl;
  snapshot: Snapshot;
}

export interface ToolSettings {
  composer: Composer;
  isMissing: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  previewProjectId: string | null;
}

export function useTools({
  composer,
  isMissing,
  isWaiting,
  openedProjectId,
  previewProjectId,
}: ToolSettings): Tools {
  const [tool, setTool] = useState<Tool>(null);
  const preview = usePreview(previewProjectId);

  const unavailable = unavailableOf({
    isMissing,
    isServing: preview.isServing,
    isWaiting,
    openedProjectId,
    previewProjectId,
  });

  useEffect(() => {
    if (unavailable !== null) {
      setTool(null);
    }
  }, [unavailable]);

  const onMessage = useCallback((message: PreviewMessage) => {
    if (message.type === "rebuilt") {
      setTool(null);
    }
  }, []);

  useOnPreview(preview, onMessage);

  const toggleInspect = useCallback(
    () => setTool((current) => (current === "inspect" ? null : "inspect")),
    []
  );

  const toggleSnapshot = useCallback(
    () => setTool((current) => (current === "snapshot" ? null : "snapshot")),
    []
  );

  const inspect = useInspect({
    composer,
    isArmed: tool === "inspect",
    preview,
    toggle: toggleInspect,
    unavailable,
  });

  const snapshot = useSnapshot({
    composer,
    isArmed: tool === "snapshot",
    preview,
    projectId: previewProjectId,
    toggle: toggleSnapshot,
    unavailable,
  });

  return useMemo(
    () => ({ inspect, preview, snapshot }),
    [inspect, preview, snapshot]
  );
}

function unavailableOf(state: {
  isMissing: boolean;
  isServing: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  previewProjectId: string | null;
}): string | null {
  if (state.openedProjectId === null) {
    return "Open a project to work on its preview.";
  }
  if (state.isMissing) {
    return "The project folder is not on disk anymore.";
  }
  if (state.isWaiting) {
    return "Answer the approval request first.";
  }
  if (!state.isServing) {
    return "The preview is not running yet.";
  }
  if (state.openedProjectId !== state.previewProjectId) {
    return "The preview is showing a different project than this session.";
  }
  return null;
}
