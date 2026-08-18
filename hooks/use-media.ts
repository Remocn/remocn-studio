"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { isPlayable, mediaOf } from "@/lib/studio/attachments";
import { pickPlayable } from "@/lib/studio/shell";
import type { PromptMedia } from "@/shared/ipc";

export interface Media {
  add: () => Promise<number>;
  attach: (paths: readonly string[]) => number;
  clear: () => void;
  error: string | null;
  items: PromptMedia[];
  removeAt: (index: number) => void;
  restore: (items: readonly PromptMedia[]) => void;
}

export function useMedia(): Media {
  const [items, setItems] = useState<PromptMedia[]>([]);
  const held = useRef<PromptMedia[]>([]);
  const { error, run } = useAsyncAction();

  const commit = useCallback((next: PromptMedia[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const attach = useCallback(
    (paths: readonly string[]) => {
      const added = arriving(held.current, paths);
      if (added.length > 0) {
        commit([...held.current, ...added]);
      }
      return added.length;
    },
    [commit]
  );

  const add = useCallback(async () => {
    const found = await run(pickPlayable());
    return found === null ? 0 : attach(found);
  }, [attach, run]);

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  const restore = useCallback(
    (next: readonly PromptMedia[]) => commit([...next]),
    [commit]
  );

  return useMemo(
    () => ({ add, attach, clear, error, items, removeAt, restore }),
    [add, attach, clear, error, items, removeAt, restore]
  );
}

function arriving(
  held: readonly PromptMedia[],
  paths: readonly string[]
): PromptMedia[] {
  const known = new Set(held.map((item) => item.path));

  return paths
    .map(mediaOf)
    .filter((item): item is PromptMedia => item !== null)
    .filter((item) => isPlayable(item.mediaType))
    .filter((item) => {
      const seen = known.has(item.path);
      known.add(item.path);
      return !seen;
    });
}
