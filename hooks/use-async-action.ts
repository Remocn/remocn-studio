"use client";

import { Effect, Exit } from "effect";
import { useCallback, useState } from "react";
import { causeMessage } from "@/lib/error-message";

export interface AsyncAction {
  error: string | null;
  run: <A, E>(effect: Effect.Effect<A, E>) => Promise<A | null>;
}

export function useAsyncAction(): AsyncAction {
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <A, E>(effect: Effect.Effect<A, E>) => {
    const exit = await Effect.runPromiseExit(effect);

    if (Exit.isSuccess(exit)) {
      setError(null);
      return exit.value;
    }

    setError(causeMessage(exit.cause));
    return null;
  }, []);

  return { error, run };
}
