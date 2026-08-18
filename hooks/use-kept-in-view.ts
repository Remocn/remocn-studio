"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";

export function useKeptInView<E extends HTMLElement>(
  isActive: boolean,
  at: string
): RefObject<E | null> {
  const ref = useRef<E>(null);
  const shown = useRef("");

  useLayoutEffect(() => {
    if (!isActive || shown.current === at) {
      return;
    }

    shown.current = at;
    ref.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [at, isActive]);

  return ref;
}
