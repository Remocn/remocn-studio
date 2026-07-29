"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { useNow } from "@/hooks/use-now";
import { type PreviewControl, usePreview } from "@/hooks/use-preview";
import {
  freezeCommand,
  inspectCommand,
  type PreviewInspect,
  type PreviewRect,
  type PreviewSelection,
  seekCommand,
} from "@/lib/studio/preview";
import type { PromptElement } from "@/shared/ipc";

const SILENCE = "500 millis";
const PATIENCE = 1500;

export interface Marker {
  id: string;
  index: number;
  rect: PreviewRect;
}

export interface PendingComment {
  element: PromptElement;
  rect: PreviewRect;
}

export interface Inspection {
  cancelComment: () => void;
  canInspect: boolean;
  card: PendingComment | null;
  isArmed: boolean;
  markers: readonly Marker[];
  preview: PreviewControl;
  seek: (event: MouseEvent<HTMLButtonElement>) => void;
  submitComment: (comment: string) => void;
  toggle: () => void;
  trouble: string | null;
  unavailable: string | null;
}

export interface InspectSettings {
  composer: Composer;
  isMissing: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  previewProjectId: string | null;
}

export function useInspect({
  composer,
  isMissing,
  isWaiting,
  openedProjectId,
  previewProjectId,
}: InspectSettings): Inspection {
  const [isArmed, setArmed] = useState(false);
  const [card, setCard] = useState<PendingComment | null>(null);
  const [drawn, setDrawn] = useState<readonly string[]>([]);
  const [asked, setAsked] = useState<number | null>(null);
  const [reported, setReported] = useState<PreviewInspect | null>(null);

  const { select, selections } = composer;

  const onSelection = useCallback((selection: PreviewSelection) => {
    setCard({ element: selection.element, rect: selection.rect });
  }, []);

  const onInspect = useCallback((inspect: PreviewInspect) => {
    setReported(inspect);
  }, []);

  const onRebuilt = useCallback(() => {
    setDrawn([]);
    setCard(null);
    setArmed(false);
  }, []);

  const handlers = useMemo(
    () => ({ onInspect, onRebuilt, onSelection }),
    [onInspect, onRebuilt, onSelection]
  );

  const preview = usePreview(previewProjectId, handlers);

  const unavailable = unavailableOf({
    isMissing,
    isServing: preview.isServing,
    isWaiting,
    openedProjectId,
    previewProjectId,
  });
  const canInspect = unavailable === null;

  const { send } = preview;

  useEffect(() => {
    if (!canInspect && isArmed) {
      setArmed(false);
    }
  }, [canInspect, isArmed]);

  useEffect(() => {
    setReported(null);
    setAsked(Date.now());
    send(inspectCommand(isArmed));

    if (!isArmed) {
      setCard(null);
      setDrawn([]);
    }
  }, [isArmed, send]);

  useEffect(() => {
    if (isArmed) {
      send(freezeCommand(card !== null));
    }
  }, [card, isArmed, send]);

  const submitComment = useCallback(
    (comment: string) => {
      if (card === null) {
        return;
      }

      const id = select(card.element, card.rect, comment);
      setDrawn((current) => [...current, id]);
      setCard(null);
    },
    [card, select]
  );

  const cancelComment = useCallback(() => setCard(null), []);

  const toggle = useCallback(() => {
    setArmed((current) => !current);
  }, []);

  const seek = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const found = selections.items[Number(event.currentTarget.value)];
      if (found !== undefined) {
        send(seekCommand(found.element.frame));
      }
    },
    [selections.items, send]
  );

  const markers = useMemo(() => {
    const showing = new Set(drawn);

    return selections.items
      .map((item, index) => ({ id: item.id, index, rect: item.rect }))
      .filter((marker) => isArmed && showing.has(marker.id));
  }, [drawn, isArmed, selections.items]);

  const now = useNow(isArmed && reported === null ? SILENCE : null);
  const trouble = troubleOf(isArmed, reported, asked, now);

  return useMemo(
    () => ({
      cancelComment,
      canInspect,
      card,
      isArmed,
      markers,
      preview,
      seek,
      submitComment,
      toggle,
      trouble,
      unavailable,
    }),
    [
      canInspect,
      card,
      cancelComment,
      isArmed,
      markers,
      preview,
      seek,
      submitComment,
      toggle,
      trouble,
      unavailable,
    ]
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
    return "Open a project to inspect its preview.";
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

function troubleOf(
  isArmed: boolean,
  reported: PreviewInspect | null,
  asked: number | null,
  now: number
): string | null {
  if (!isArmed) {
    return null;
  }

  if (reported === null) {
    return asked !== null && now - asked > PATIENCE
      ? "Inspect is on, but the preview never answered — its page is probably from an older build. Restart the preview."
      : null;
  }

  if (reported.status === "no-grab") {
    return "The preview page loaded without React Grab, so nothing can be picked.";
  }

  if (reported.status === "no-canvas") {
    return "The player is not on screen yet, so there is nothing to pick from.";
  }

  if (reported.status === "inert") {
    return "React Grab loaded but refused to turn on.";
  }

  return reported.paused
    ? null
    : "The preview answered, but its player did not — the video will not pause.";
}
