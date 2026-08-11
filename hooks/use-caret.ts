"use client";

import type { RefObject, UIEvent } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

export interface Caret {
  mirror: RefObject<HTMLDivElement | null>;
  moveTo: (at: number) => void;
  onScroll: (event: UIEvent<HTMLTextAreaElement>) => void;
  ref: RefObject<HTMLTextAreaElement | null>;
}

export function useCaret(): Caret {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (field === null) {
      return;
    }

    const at = pending.current;
    if (at !== null) {
      pending.current = null;
      field.focus();
      field.setSelectionRange(at, at);
    }

    if (mirror.current !== null) {
      mirror.current.scrollTop = field.scrollTop;
    }
  });

  const moveTo = useCallback((at: number) => {
    pending.current = at;
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    if (mirror.current !== null) {
      mirror.current.scrollTop = event.currentTarget.scrollTop;
    }
  }, []);

  // Every part of this is constant, so the handle is too — a fresh object here
  // would remint each composer callback that closes over it, every render, and
  // with them every memo those callbacks are handed to.
  return useMemo(() => ({ mirror, moveTo, onScroll, ref }), [moveTo, onScroll]);
}
