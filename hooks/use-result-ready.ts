"use client";

import { useCallback, useState } from "react";
import { type PreviewControl, usePreviewMessage } from "@/hooks/use-preview";
import { type PreviewComposition, seekCommand } from "@/lib/studio/preview";
import type { UserEntry } from "@/shared/ipc";

export function useResultReady(
  preview: PreviewControl,
  request: UserEntry | undefined,
  onOpenPreview: () => void
) {
  const { channel, composition, pick } = preview;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [rebuilt, setRebuilt] = useState<string | null>(null);
  const requestId = request?.id ?? null;

  const onRebuilt = useCallback(() => {
    setLoaded(null);
    setRebuilt(requestId);
  }, [requestId]);
  usePreviewMessage(preview, "rebuilt", onRebuilt);

  const onComposition = useCallback(
    (message: PreviewComposition) =>
      setLoaded(
        message.metadata !== null &&
          message.trouble === null &&
          message.compositionId === composition
          ? requestId
          : null
      ),
    [composition, requestId]
  );
  usePreviewMessage(preview, "composition", onComposition);

  const target = request?.elements.find(
    (element) => element.composition === composition && element.fps > 0
  );
  const metadata = pick?.metadata ?? null;
  const open = useCallback(() => {
    onOpenPreview();
    if (target && metadata) {
      channel.send(
        seekCommand(
          Math.max(
            0,
            Math.min(
              Math.round((target.frame / target.fps) * metadata.fps),
              metadata.durationInFrames - 1
            )
          )
        )
      );
    }
  }, [channel, metadata, onOpenPreview, target]);

  return {
    open,
    ready: requestId !== null && rebuilt === requestId && loaded === requestId,
    target,
  };
}
