"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { revealInFinder } from "@/lib/studio/shell";

export interface RevealInFinder {
  canReveal: boolean;
  error: string | null;
  reveal: () => Promise<void>;
}

export function useRevealInFinder(path: string | null): RevealInFinder {
  const { error, run } = useAsyncAction();

  const reveal = useCallback(async () => {
    if (path === null) {
      return;
    }
    await run(revealInFinder(path));
  }, [path, run]);

  return { canReveal: path !== null, error, reveal };
}
