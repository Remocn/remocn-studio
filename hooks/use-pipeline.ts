"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPipeline, startPipeline } from "@/lib/studio/pipeline";
import type { PipelineStage } from "@/shared/pipeline";

export interface Pipeline {
  readonly stages: readonly PipelineStage[];
  readonly start: () => void;
}

export function usePipeline(sessionId: string, isRunning: boolean): Pipeline {
  const [stages, setStages] = useState<readonly PipelineStage[]>([]);
  const shown = useRef(sessionId);

  useEffect(() => {
    if (shown.current !== sessionId) {
      shown.current = sessionId;
      setStages([]);
    }

    // While a turn runs the agent may be moving the stages; refetching when it
    // ends (and on opening the session) is what keeps the dock honest without
    // polling.
    if (isRunning) {
      return;
    }

    const fiber = Effect.runFork(
      loadPipeline(sessionId).pipe(
        Effect.tap((state) => Effect.sync(() => setStages(state.stages))),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [sessionId, isRunning]);

  const start = useCallback(() => {
    Effect.runFork(
      startPipeline(sessionId).pipe(
        Effect.tap((state) => Effect.sync(() => setStages(state.stages))),
        Effect.ignore
      )
    );
  }, [sessionId]);

  return { stages, start };
}
