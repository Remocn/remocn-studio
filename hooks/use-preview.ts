"use client";

import { Effect, Exit, Fiber } from "effect";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decodePreviewMessage,
  originOf,
  type PreviewCommand,
  type PreviewComposition,
  type PreviewInspect,
  type PreviewSelection,
  startPreview,
} from "@/lib/studio/preview";

export type Preview =
  | { phase: "building"; percent: number }
  | { phase: "failed"; message: string }
  | { phase: "idle" }
  | { phase: "ready"; url: string };

export interface PreviewHandlers {
  onInspect: (inspect: PreviewInspect) => void;
  onRebuilt: () => void;
  onSelection: (selection: PreviewSelection) => void;
}

export interface PreviewControl {
  hint: string | null;
  isServing: boolean;
  preview: Preview;
  restart: () => void;
  send: (command: PreviewCommand) => void;
  stage: RefObject<HTMLIFrameElement | null>;
}

const IDLE: Preview = { phase: "idle" };

type Running = Fiber.Fiber<unknown, unknown>;

export function usePreview(
  projectId: string | null,
  handlers: PreviewHandlers
): PreviewControl {
  const [preview, setPreview] = useState<Preview>(IDLE);
  const [pick, setPick] = useState<PreviewComposition | null>(null);
  const running = useRef<Running | null>(null);
  const stage = useRef<HTMLIFrameElement>(null);

  const origin = preview.phase === "ready" ? originOf(preview.url) : null;
  const { onInspect, onRebuilt, onSelection } = handlers;

  const stop = useCallback(() => {
    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
      running.current = null;
    }
  }, []);

  const launch = useCallback((target: string) => {
    let served = false;

    setPick(null);
    setPreview({ percent: 0, phase: "building" });

    running.current = Effect.runFork(
      startPreview({ projectId: target }, (event) => {
        if (event.type === "building") {
          if (!served) {
            setPreview({ percent: event.percent, phase: "building" });
          }
          return;
        }
        if (event.type === "ready") {
          served = true;
          setPreview({ phase: "ready", url: event.url });
          return;
        }
        served = false;
        setPreview({ message: event.message, phase: "failed" });
      }).pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            setPreview({ message: error.message, phase: "failed" });
          })
        )
      )
    );
  }, []);

  useEffect(() => {
    if (projectId === null) {
      setPick(null);
      setPreview(IDLE);
      return;
    }

    launch(projectId);

    return stop;
  }, [launch, projectId, stop]);

  useEffect(() => {
    if (origin === null) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) {
        return;
      }

      const decoded = decodePreviewMessage(event.data);
      if (Exit.isFailure(decoded)) {
        return;
      }

      if (decoded.value.type === "composition") {
        setPick(decoded.value);
        return;
      }
      if (decoded.value.type === "selection") {
        onSelection(decoded.value);
        return;
      }
      if (decoded.value.type === "inspect") {
        onInspect(decoded.value);
        return;
      }
      onRebuilt();
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [onInspect, onRebuilt, onSelection, origin]);

  const send = useCallback(
    (command: PreviewCommand) => {
      if (origin !== null) {
        stage.current?.contentWindow?.postMessage(command, origin);
      }
    },
    [origin]
  );

  const restart = useCallback(() => {
    stop();
    if (projectId !== null) {
      launch(projectId);
    }
  }, [launch, projectId, stop]);

  const hint = useMemo(() => hintOf(pick), [pick]);

  return useMemo(
    () => ({
      hint,
      isServing: preview.phase === "ready",
      preview,
      restart,
      send,
      stage,
    }),
    [hint, preview, restart, send]
  );
}

function hintOf(message: PreviewComposition | null): string | null {
  if (message === null) {
    return null;
  }

  if (message.compositionId === null) {
    return "This project registers no compositions.";
  }

  if (message.unmeasured) {
    return `${message.compositionId} computes its metadata, which the preview cannot resolve yet.`;
  }

  if (message.reason === "folder") {
    return `Playing ${message.compositionId}, matched from the folder you opened.`;
  }

  if (message.reason === "first") {
    return `No composition called Main, so ${message.compositionId} is playing.`;
  }

  return null;
}
