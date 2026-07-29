"use client";

import { Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { useNow } from "@/hooks/use-now";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import { causeMessage } from "@/lib/error-message";
import { takeSnapshot } from "@/lib/studio/capture";
import {
  type PreviewCapture,
  type PreviewMessage,
  type PreviewSnapshot,
  snapshotCommand,
  warmComposition,
} from "@/lib/studio/preview";
import type { StillEvent } from "@/shared/ipc";

const SILENCE = "500 millis";
const PATIENCE = 1500;

export interface Snapshot {
  canSnapshot: boolean;
  isArmed: boolean;
  isBusy: boolean;
  status: string | null;
  toggle: () => void;
  trouble: string | null;
  unavailable: string | null;
}

export interface SnapshotSettings {
  composer: Composer;
  isArmed: boolean;
  preview: PreviewControl;
  projectId: string | null;
  toggle: () => void;
  unavailable: string | null;
}

export function useSnapshot({
  composer,
  isArmed,
  preview,
  projectId,
  toggle,
  unavailable,
}: SnapshotSettings): Snapshot {
  const [progress, setProgress] = useState<StillEvent | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [asked, setAsked] = useState<number | null>(null);
  const [reported, setReported] = useState<PreviewSnapshot | null>(null);
  const busy = useRef(false);

  const { capture } = composer;

  const take = useCallback(
    async (message: PreviewCapture) => {
      if (busy.current || projectId === null) {
        return;
      }

      busy.current = true;
      setFailure(null);
      setProgress({ type: "rendering" });

      const exit = await Effect.runPromiseExit(
        takeSnapshot(
          {
            composition: message.composition,
            frame: message.frame,
            projectId,
            rect: message.rect,
          },
          setProgress
        )
      );

      busy.current = false;
      setProgress(null);

      if (Exit.isFailure(exit)) {
        setFailure(causeMessage(exit.cause));
        return;
      }

      await capture(exit.value);
    },
    [capture, projectId]
  );

  const onMessage = useCallback(
    (message: PreviewMessage) => {
      if (message.type === "snapshot") {
        setReported(message);
        return;
      }

      if (message.type === "capture") {
        take(message).catch(() => undefined);
      }
    },
    [take]
  );

  useOnPreview(preview, onMessage);

  const { composition, send } = preview;

  useEffect(() => {
    setReported(null);
    setAsked(Date.now());
    setFailure(null);
    send(snapshotCommand(isArmed));
  }, [isArmed, send]);

  useEffect(() => {
    if (!isArmed || composition === null || projectId === null) {
      return;
    }

    const warming = Effect.runFork(
      Effect.ignore(warmComposition({ composition, projectId }))
    );

    return () => {
      Effect.runFork(Fiber.interrupt(warming));
    };
  }, [composition, isArmed, projectId]);

  const now = useNow(isArmed && reported === null ? SILENCE : null);

  return useMemo(
    () => ({
      canSnapshot: unavailable === null,
      isArmed,
      isBusy: progress !== null,
      status: statusOf(progress),
      toggle,
      trouble: failure ?? troubleOf(isArmed, reported, asked, now),
      unavailable,
    }),
    [asked, failure, isArmed, now, progress, reported, toggle, unavailable]
  );
}

function statusOf(progress: StillEvent | null): string | null {
  if (progress === null) {
    return null;
  }

  return progress.type === "browser"
    ? `Downloading the renderer's browser — ${progress.percent}%`
    : "Rendering the frame at full resolution…";
}

function troubleOf(
  isArmed: boolean,
  reported: PreviewSnapshot | null,
  asked: number | null,
  now: number
): string | null {
  if (!isArmed) {
    return null;
  }

  if (reported === null) {
    return asked !== null && now - asked > PATIENCE
      ? "Snapshot is on, but the preview never answered — its page is probably from an older build. Restart the preview."
      : null;
  }

  if (reported.status === "no-canvas") {
    return "The player is not on screen yet, so there is nothing to capture.";
  }

  return reported.paused
    ? null
    : "The preview answered, but its player did not — the video will not pause.";
}
