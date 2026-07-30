"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { useNow } from "@/hooks/use-now";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import {
  freezeCommand,
  inspectCommand,
  type PreviewInspect,
  type PreviewMessage,
  type PreviewRect,
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
  seek: (event: MouseEvent<HTMLButtonElement>) => void;
  submitComment: (comment: string) => void;
  toggle: () => void;
  trouble: string | null;
  unavailable: string | null;
}

export interface InspectSettings {
  composer: Composer;
  isArmed: boolean;
  preview: PreviewControl;
  toggle: () => void;
  unavailable: string | null;
}

export function useInspect({
  composer,
  isArmed,
  preview,
  toggle,
  unavailable,
}: InspectSettings): Inspection {
  const [card, setCard] = useState<PendingComment | null>(null);
  const [drawn, setDrawn] = useState<readonly string[]>([]);
  const [asked, setAsked] = useState<number | null>(null);
  const [reported, setReported] = useState<PreviewInspect | null>(null);

  const { select, selections } = composer;

  const onMessage = useCallback((message: PreviewMessage) => {
    if (message.type === "selection") {
      setCard({ element: message.element, rect: message.rect });
      return;
    }

    if (message.type === "inspect") {
      setReported(message);
      return;
    }

    if (message.type === "rebuilt") {
      setDrawn([]);
      setCard(null);
    }
  }, []);

  useOnPreview(preview, onMessage);

  const { send } = preview;

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
      canInspect: unavailable === null,
      card,
      isArmed,
      markers,
      seek,
      submitComment,
      toggle,
      trouble,
      unavailable,
    }),
    [
      card,
      cancelComment,
      isArmed,
      markers,
      seek,
      submitComment,
      toggle,
      trouble,
      unavailable,
    ]
  );
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
    return "React Grab did not load, so selections will carry no source location.";
  }

  if (reported.status === "no-canvas") {
    return "The player is not on screen yet, so there is nothing to pick from.";
  }

  return reported.paused
    ? null
    : "The preview answered, but its player did not — the video will not pause.";
}
