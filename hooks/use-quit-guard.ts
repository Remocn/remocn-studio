"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quitStudio, watchQuitRequests } from "@/lib/studio/sidecar";

export interface QuitGuard {
  isAsking: boolean;
  quitAnyway: () => void;
  setAsking: (isAsking: boolean) => void;
}

export function useQuitGuard(hasRunningTurns: boolean): QuitGuard {
  const [isAsking, setAsking] = useState(false);
  const running = useRef(hasRunningTurns);

  useEffect(() => {
    running.current = hasRunningTurns;
  }, [hasRunningTurns]);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchQuitRequests(() => {
            if (running.current) {
              setAsking(true);
              return;
            }
            Effect.runFork(quitStudio);
          });
          yield* Effect.never;
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  const quitAnyway = useCallback(() => {
    setAsking(false);
    Effect.runFork(quitStudio);
  }, []);

  return useMemo(
    () => ({ isAsking, quitAnyway, setAsking }),
    [isAsking, quitAnyway]
  );
}
