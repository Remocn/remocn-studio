"use client";

import { Effect, Exit } from "effect";
import { useEffect, useMemo, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { loadTranscript } from "@/lib/studio/history";
import type { TranscriptEntry } from "@/shared/ipc";

export interface SessionTranscript {
  entries: readonly TranscriptEntry[];
  error: string | null;
  isLoading: boolean;
}

const EMPTY: readonly TranscriptEntry[] = [];

export function useSessionTranscript(
  sessionId: string | null
): SessionTranscript {
  const [entries, setEntries] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(sessionId !== null);

  useEffect(() => {
    if (sessionId === null) {
      setEntries(EMPTY);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    Effect.runPromiseExit(loadTranscript(sessionId)).then((exit) => {
      if (!active) {
        return;
      }

      setEntries(Exit.isSuccess(exit) ? exit.value : EMPTY);
      setError(Exit.isSuccess(exit) ? null : causeMessage(exit.cause));
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [sessionId]);

  return useMemo(
    () => ({ entries, error, isLoading }),
    [entries, error, isLoading]
  );
}
