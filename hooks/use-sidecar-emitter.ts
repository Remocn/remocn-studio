"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { EmitResult } from "@/shared/ipc";

const COUNT = 13;
const DELAY_MS = 110;

export interface SidecarEmitter {
  cancel: () => void;
  error: string | null;
  isRunning: boolean;
  start: () => void;
  tokens: string[];
}

export function useSidecarEmitter(): SidecarEmitter {
  const [tokens, setTokens] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const inflight = useRef<Fiber.Fiber<EmitResult, SidecarError> | null>(null);

  const start = useCallback(() => {
    if (inflight.current !== null) {
      return;
    }

    setTokens([]);
    setError(null);
    setIsRunning(true);

    const emit = Effect.gen(function* () {
      const id = yield* newRequestId;

      return yield* requestSidecar({
        id,
        method: "sidecar.emit",
        onStream: (chunk) => setTokens((current) => [...current, chunk.token]),
        params: { count: COUNT, delayMs: DELAY_MS },
      }).pipe(
        Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
      );
    }).pipe(
      Effect.onExit((exit) =>
        Effect.sync(() => {
          inflight.current = null;
          setIsRunning(false);
          setError(exit._tag === "Success" ? null : causeMessage(exit.cause));
        })
      )
    );

    inflight.current = Effect.runFork(emit);
  }, []);

  const cancel = useCallback(() => {
    const fiber = inflight.current;
    if (fiber === null) {
      return;
    }
    Effect.runFork(Fiber.interrupt(fiber));
  }, []);

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({ cancel, error, isRunning, start, tokens }),
    [cancel, error, isRunning, start, tokens]
  );
}
