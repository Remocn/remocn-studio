"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { PreviewControl } from "@/hooks/use-preview";
import { useResultReady } from "@/hooks/use-result-ready";
import { useStudio, useStudioTurn } from "./studio-provider";

/** A server URL alone does not mean the rebuilt composition has mounted. */
export function ChatResult() {
  const { tools, docs, isPreviewShown, togglePreview } = useStudio();
  const turn = useStudioTurn();
  const { preview } = tools;
  const show = useCallback(() => {
    docs.pickMode("preview");
    if (!isPreviewShown) {
      togglePreview();
    }
  }, [docs, isPreviewShown, togglePreview]);
  return (
    <ChatResultLink
      key={preview.composition}
      onOpenPreview={show}
      preview={preview}
      turn={turn}
    />
  );
}

export function ChatResultLink({
  preview,
  turn,
  onOpenPreview,
}: {
  preview: PreviewControl;
  turn: Pick<
    OpenTurn,
    "entries" | "isRunning" | "turnError" | "permission" | "source"
  >;
  onOpenPreview: () => void;
}) {
  const request = turn.entries.findLast((entry) => entry.kind === "user");
  const { open, ready, target } = useResultReady(
    preview,
    request,
    onOpenPreview
  );

  if (
    !ready ||
    turn.isRunning ||
    turn.turnError !== null ||
    turn.permission !== null ||
    turn.source !== null ||
    preview.preview.phase !== "ready" ||
    turn.entries.at(-1)?.kind !== "assistant"
  ) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <span>Updated preview ready</span>
      <Button onClick={open} size="xs" variant="ghost">
        {target ? "View change" : "View preview"}
      </Button>
    </div>
  );
}
