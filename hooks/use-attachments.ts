"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { attachmentOf } from "@/lib/studio/attachments";
import { pickImages } from "@/lib/studio/shell";
import type { PromptAttachment } from "@/shared/ipc";

export interface Attachments {
  add: () => Promise<void>;
  clear: () => void;
  error: string | null;
  items: PromptAttachment[];
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function useAttachments(): Attachments {
  const [items, setItems] = useState<PromptAttachment[]>([]);
  const { error, run } = useAsyncAction();

  const add = useCallback(async () => {
    const picked = await run(pickImages());
    if (picked === null) {
      return;
    }

    setItems((current) => merge(current, picked));
  }, [run]);

  const onRemove = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.value;
    setItems((current) => current.filter((item) => item.path !== path));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return useMemo(
    () => ({ add, clear, error, items, onRemove }),
    [add, clear, error, items, onRemove]
  );
}

function merge(
  current: PromptAttachment[],
  picked: string[]
): PromptAttachment[] {
  const known = new Set(current.map((item) => item.path));
  const added = picked
    .filter((path) => !known.has(path))
    .map(attachmentOf)
    .filter((item): item is PromptAttachment => item !== null);

  return added.length === 0 ? current : [...current, ...added];
}
