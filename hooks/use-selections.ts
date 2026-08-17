"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PreviewRect } from "@/lib/studio/preview";
import type { PromptElement } from "@/shared/ipc";

export interface Selection {
  element: PromptElement;
  id: string;
  rect: PreviewRect;
}

export interface Added {
  id: string;
  index: number;
}

export interface Selections {
  add: (element: PromptElement, rect: PreviewRect) => Added;
  clear: () => void;
  items: Selection[];
  removeAt: (index: number) => void;
  restore: (elements: readonly PromptElement[]) => void;
}

const OFF_FRAME: PreviewRect = { height: 0, width: 0, x: 0, y: 0 };

export function useSelections(): Selections {
  const [items, setItems] = useState<Selection[]>([]);
  const held = useRef<Selection[]>([]);
  const minted = useRef(0);

  const commit = useCallback((next: Selection[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const add = useCallback(
    (element: PromptElement, rect: PreviewRect): Added => {
      minted.current += 1;
      const id = `selection-${minted.current}`;
      commit([...held.current, { element, id, rect }]);
      return { id, index: held.current.length - 1 };
    },
    [commit]
  );

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  const restore = useCallback(
    (elements: readonly PromptElement[]) => {
      commit(
        elements.map((element) => {
          minted.current += 1;
          return {
            element,
            id: `selection-${minted.current}`,
            rect: OFF_FRAME,
          };
        })
      );
    },
    [commit]
  );

  return useMemo(
    () => ({ add, clear, items, removeAt, restore }),
    [add, clear, items, removeAt, restore]
  );
}
