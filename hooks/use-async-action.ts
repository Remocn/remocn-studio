"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/error-message";

export interface AsyncAction {
  error: string | null;
  run: <T>(action: () => Promise<T>) => Promise<T | null>;
}

export function useAsyncAction(): AsyncAction {
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(action: () => Promise<T>) => {
    try {
      const result = await action();
      setError(null);
      return result;
    } catch (cause) {
      setError(errorMessage(cause));
      return null;
    }
  }, []);

  return { error, run };
}
