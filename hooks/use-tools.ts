"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { type Deletion, useDeletion } from "@/hooks/use-deletion";
import { type Exporting, useExport } from "@/hooks/use-export";
import { type Inspection, useInspect } from "@/hooks/use-inspect";
import {
  type ManagedObjects,
  useManagedObjects,
} from "@/hooks/use-managed-objects";
import { type PreviewControl, usePreviewMessage } from "@/hooks/use-preview";
import { type Snapshot, useSnapshot } from "@/hooks/use-snapshot";

type Tool = "snapshot" | null;

export interface Tools {
  deletion: Deletion;
  exporting: Exporting;
  inspect: Inspection;
  managed?: ManagedObjects;
  preview: PreviewControl;
  snapshot: Snapshot;
}

export interface ToolSettings {
  composer: Composer;
  isDocs: boolean;
  isMissing: boolean;
  isShown: boolean;
  isTurnRunning?: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  preview: PreviewControl;
  previewProjectId: string | null;
  projectPath?: string;
  writeProjectId?: string | null;
}

export function useTools({
  composer,
  isDocs,
  isMissing,
  isShown,
  isTurnRunning = false,
  isWaiting,
  openedProjectId,
  preview,
  previewProjectId,
  projectPath,
  writeProjectId = null,
}: ToolSettings): Tools {
  const [tool, setTool] = useState<Tool>(null);

  const unavailable = unavailableOf({
    isDocs,
    isMissing,
    isServing: preview.isServing,
    isShown,
    isWaiting,
    openedProjectId,
    previewProjectId,
  });

  useEffect(() => {
    if (unavailable !== null) {
      setTool(null);
    }
  }, [unavailable]);

  const managed = useManagedObjects({
    armed: false,
    enabled: openedProjectId === previewProjectId,
    inlineEnabled: unavailable === null && tool === null,
    preview,
    projectId: writeProjectId,
  });
  const openObjects = managed.open;
  const { focus, send } = preview.channel;

  const toggleInspect = useCallback(() => {
    if (unavailable !== null) {
      return;
    }
    setTool(null);
    openObjects();
    focus();
  }, [focus, openObjects, unavailable]);

  const toggleSnapshot = useCallback(() => {
    if (unavailable !== null) {
      return;
    }
    setTool(tool === "snapshot" ? null : "snapshot");
  }, [tool, unavailable]);

  const inspect = useInspect({
    composer,
    isArmed: unavailable === null && tool === null,
    preview,
    projectId: writeProjectId,
    toggle: toggleInspect,
    unavailable,
  });

  const deletion = useDeletion({
    inspect,
    isTurnRunning,
    managed,
    preview,
    projectId: writeProjectId,
  });

  const snapshot = useSnapshot({
    composer,
    isArmed: tool === "snapshot",
    preview,
    projectId: previewProjectId,
    toggle: toggleSnapshot,
    unavailable,
  });

  const { cancelComment } = inspect;
  const closeObjects = managed.close;
  const dismiss = useCallback(() => {
    if (tool === "snapshot") {
      setTool(null);
      return;
    }
    send({ type: "inspect.clear" });
    cancelComment();
    closeObjects();
  }, [cancelComment, closeObjects, send, tool]);

  const onRebuilt = useCallback(() => setTool(null), []);
  usePreviewMessage(preview, "rebuilt", onRebuilt);
  usePreviewMessage(preview, "inspect.clear", dismiss);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        document.fullscreenElement === null
      ) {
        dismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  const exporting = useExport({
    composition: preview.composition,
    isServing: preview.isServing,
    managedPending:
      managed.pending +
      (managed.busy || managed.awaitingPreview || managed.editingText ? 1 : 0),
    metadata: preview.pick?.metadata ?? null,
    openedProjectId,
    projectId: previewProjectId,
    projectPath,
    selections: composer.selections.items,
  });

  return useMemo(
    () => ({ deletion, exporting, inspect, managed, preview, snapshot }),
    [deletion, exporting, inspect, preview, snapshot, managed]
  );
}

function unavailableOf(state: {
  isDocs: boolean;
  isMissing: boolean;
  isServing: boolean;
  isShown: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  previewProjectId: string | null;
  projectPath?: string;
}): string | null {
  if (!state.isShown) {
    return "The preview pane is hidden.";
  }
  // Moving to Docs disarms whatever was armed, down the same path a rebuild
  // takes: the tools point at pixels that are no longer on screen.
  if (state.isDocs) {
    return "The pane is showing the documents.";
  }
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
    return "The preview is showing another project, not the one this chat belongs to.";
  }
  return null;
}
