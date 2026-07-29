"use client";

import type { RefCallback } from "react";
import { useCallback, useMemo, useState } from "react";
import type { Size } from "@/lib/studio/card";

export interface Measured<E extends HTMLElement> {
  ref: RefCallback<E>;
  size: Size;
}

const NOTHING: Size = { height: 0, width: 0 };

export function useElementSize<E extends HTMLElement>(): Measured<E> {
  const [size, setSize] = useState<Size>(NOTHING);

  const ref = useCallback((node: E | null) => {
    if (node === null || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const box = entries.at(0)?.contentRect;
      if (box !== undefined) {
        setSize({ height: box.height, width: box.width });
      }
    });

    observer.observe(node);
    setSize({ height: node.clientHeight, width: node.clientWidth });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => ({ ref, size }), [ref, size]);
}
