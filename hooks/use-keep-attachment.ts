"use client";

import type { MouseEvent } from "react";
import { useCallback, useRef } from "react";
import type { PromptMedia } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

export function useKeepAttachment(
  items: readonly PromptMedia[],
  save: (item: PromptMedia) => Promise<Asset | null>
): (event: MouseEvent<HTMLButtonElement>) => Promise<void> {
  const held = useRef(items);
  held.current = items;

  return useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const attachment = held.current[Number(event.currentTarget.value)];
      if (attachment !== undefined) {
        await save(attachment);
      }
    },
    [save]
  );
}
