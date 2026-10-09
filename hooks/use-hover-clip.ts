"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface ClipFallback {
  isBroken: boolean;
  isPlaying: boolean;
  onError: () => void;
  onOpenChange: (open: boolean) => void;
  play: () => void;
  ref: (node: HTMLVideoElement | null) => void;
}

export function useClipFallback(): ClipFallback {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isBroken, setBroken] = useState(false);
  const [requested, setRequested] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const isPlaying = !reduced || requested;
  const onError = useCallback(() => setBroken(true), []);
  const play = useCallback(() => setRequested(true), []);
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) {
      video.current?.pause();
      setRequested(false);
    }
  }, []);
  const ref = useCallback(
    (node: HTMLVideoElement | null) => {
      if (video.current !== node) {
        video.current?.pause();
      }
      video.current = node;
      if (node && isPlaying) {
        node.muted = true;
        node.play().catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") {
            return;
          }
          setBroken(true);
        });
      }
    },
    [isPlaying]
  );
  return useMemo(
    () => ({ isBroken, isPlaying, onError, onOpenChange, play, ref }),
    [isBroken, isPlaying, onError, onOpenChange, play, ref]
  );
}
