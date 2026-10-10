"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useState } from "react";
import { listBundled } from "@/lib/studio/library";
import type { Asset } from "@/shared/library";

export function useBundledLibrary() {
  const [state, setState] = useState<{
    assets: readonly Asset[];
    error: string | null;
    revision: number;
  }>({ assets: [], error: null, revision: -1 });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const fiber = Effect.runFork(
      listBundled.pipe(
        Effect.tap((assets) =>
          Effect.sync(() => setState({ assets, error: null, revision }))
        ),
        Effect.catch((failure) =>
          Effect.sync(() =>
            setState((previous) => ({
              ...previous,
              error: failure.message,
              revision,
            }))
          )
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [revision]);
  return {
    assets: state.assets,
    error: state.error,
    isLoading: state.revision !== revision,
    reload,
  };
}
