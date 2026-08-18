"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { attachmentOf } from "@/lib/studio/attachments";
import { saveImages } from "@/lib/studio/clipboard";
import { pickImages } from "@/lib/studio/shell";
import type { PromptAttachment } from "@/shared/ipc";

export interface Attachments {
  add: () => Promise<number>;
  attach: (files: readonly File[]) => Promise<number>;
  attachPaths: (paths: readonly string[]) => number;
  clear: () => void;
  error: string | null;
  items: PromptAttachment[];
  removeAt: (index: number) => void;
  restore: (items: readonly PromptAttachment[]) => void;
}

export function useAttachments(): Attachments {
  const [items, setItems] = useState<PromptAttachment[]>([]);
  const held = useRef<PromptAttachment[]>([]);
  const { error, run } = useAsyncAction();

  const commit = useCallback((next: PromptAttachment[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const append = useCallback(
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
    const picked = await run(pickImages());
    return picked === null ? 0 : append(picked);
  }, [append, run]);

  const attach = useCallback(
    async (files: readonly File[]) => {
      const saved = await run(saveImages(files));
      return saved === null ? 0 : append(saved);
    },
    [append, run]
  );

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  const restore = useCallback(
    (next: readonly PromptAttachment[]) => commit([...next]),
    [commit]
  );

  return useMemo(
    () => ({
      add,
      attach,
      attachPaths: append,
      clear,
      error,
      items,
      removeAt,
      restore,
    }),
    [add, append, attach, clear, error, items, removeAt, restore]
  );
}

function arriving(
  held: readonly PromptAttachment[],
  paths: readonly string[]
): PromptAttachment[] {
  const known = new Set(held.map((item) => item.path));

  return paths
    .map(attachmentOf)
    .filter((item): item is PromptAttachment => item !== null)
    .filter((item) => {
      const seen = known.has(item.path);
      known.add(item.path);
      return !seen;
    });
}
