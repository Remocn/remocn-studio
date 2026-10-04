"use client";

import { useCallback, useRef } from "react";
import { type PreviewControl, usePreviewMessage } from "@/hooks/use-preview";
import type { PreviewComposition } from "@/lib/studio/preview";

// The rows draw the pane instantly and the bundle corrects them seconds later:
// a composition nobody recorded becomes a video, a video nothing renders is
// marked absent, and one the person deleted stays deleted. The guard is the
// project the *preview* compiled, which is not always the one now selected.
export function useReconciledVideos(
  preview: PreviewControl,
  projectId: string | null,
  reconcile: (projectId: string, compositions: readonly string[]) => void
): void {
  const seen = useRef<string | null>(null);

  const listen = useCallback(
    (message: PreviewComposition) => {
      if (projectId === null) {
        return;
      }

      const named = [...message.compositions].sort().join(" ");
      const signature = `${projectId}:${named}`;
      if (seen.current === signature) {
        return;
      }
      seen.current = signature;

      reconcile(projectId, message.compositions);
    },
    [projectId, reconcile]
  );

  usePreviewMessage(preview, "composition", listen);
}
