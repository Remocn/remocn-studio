"use client";

import { Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decodePreviewMessage,
  type PreviewMessage,
  startPreview,
} from "@/lib/studio/preview";

export type Preview =
  | { phase: "building"; percent: number }
  | { phase: "failed"; message: string }
  | { phase: "idle" }
  | { phase: "ready"; url: string };

export interface PreviewControl {
  hint: string | null;
  preview: Preview;
  restart: () => void;
}

const IDLE: Preview = { phase: "idle" };

type Running = Fiber.Fiber<unknown, unknown>;

export function usePreview(projectId: string | null): PreviewControl {
  const [preview, setPreview] = useState<Preview>(IDLE);
  const [message, setMessage] = useState<PreviewMessage | null>(null);
  const running = useRef<Running | null>(null);

  const stop = useCallback(() => {
    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
      running.current = null;
    }
  }, []);

  const launch = useCallback((target: string) => {
    let served = false;

    setMessage(null);
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
      setMessage(null);
      setPreview(IDLE);
      return;
    }

    launch(projectId);

    return stop;
  }, [launch, projectId, stop]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const decoded = decodePreviewMessage(event.data);
      if (Exit.isSuccess(decoded)) {
        setMessage(decoded.value);
      }
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const restart = useCallback(() => {
    stop();
    if (projectId !== null) {
      launch(projectId);
    }
  }, [launch, projectId, stop]);

  const hint = useMemo(() => hintOf(message), [message]);

  return useMemo(() => ({ hint, preview, restart }), [hint, preview, restart]);
}

function hintOf(message: PreviewMessage | null): string | null {
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
