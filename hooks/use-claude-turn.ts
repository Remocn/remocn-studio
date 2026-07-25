"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { answerPermission, promptClaude } from "@/lib/studio/claude";
import type { PermissionAction } from "@/lib/studio/permission";
import type { SidecarError } from "@/lib/studio/sidecar";
import type {
  ContextUsage,
  EffortLevel,
  HistorySession,
  PermissionReason,
  PromptAttachment,
  PromptResult,
  TranscriptEntry,
} from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";

export interface PendingPermission {
  id: string;
  input: unknown;
  name: string;
  reason: PermissionReason;
}

export interface TurnSettings {
  cwd: string | null;
  effort: EffortLevel | null;
  historyId: string | null;
  initial: readonly TranscriptEntry[];
  model: string | null;
  onSession: (session: HistorySession) => void;
  sdkSessionId: string | null;
}

export interface ClaudeTurn {
  answer: (id: string, action: PermissionAction) => void;
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isRunning: boolean;
  permission: PendingPermission | null;
  send: (prompt: string, attachments?: readonly PromptAttachment[]) => void;
  stop: () => void;
}

export function useClaudeTurn({
  cwd,
  effort,
  historyId,
  initial,
  model,
  onSession,
  sdkSessionId,
}: TurnSettings): ClaudeTurn {
  const [entries, setEntries] = useState(initial);
  const [permissions, setPermissions] = useState<PendingPermission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState(sdkSessionId);
  const [storedId, setStoredId] = useState(historyId);
  const [context, setContext] = useState<ContextUsage | null>(null);
  const inflight = useRef<Fiber.Fiber<PromptResult, SidecarError> | null>(null);

  const stop = useCallback(() => {
    const fiber = inflight.current;
    if (fiber !== null) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const answer = useCallback(
    (id: string, action: PermissionAction) => {
      if (action === "cancel") {
        stop();
        return;
      }

      setPermissions((current) =>
        current.filter((pending) => pending.id !== id)
      );

      Effect.runFork(
        answerPermission({ decision: action, id }).pipe(
          Effect.catch((failure) =>
            Effect.sync(() => setError(failure.message))
          )
        )
      );
    },
    [stop]
  );

  const send = useCallback(
    (prompt: string, attachments: readonly PromptAttachment[] = []) => {
      const trimmed = prompt.trim();
      const isEmpty = trimmed.length === 0 && attachments.length === 0;
      if (cwd === null || isEmpty || inflight.current !== null) {
        return;
      }

      setError(null);
      setIsRunning(true);
      setEntries((current) =>
        appendUser(current, { attachments, text: trimmed })
      );

      const turn = promptClaude(
        {
          attachments,
          cwd,
          effort,
          historyId: storedId,
          model,
          prompt: trimmed,
          sessionId,
        },
        (event) => {
          if (event.type === "session") {
            setSessionId(event.sessionId);
            return;
          }
          if (event.type === "history") {
            setStoredId(event.session.id);
            onSession(event.session);
            return;
          }
          if (event.type === "permission") {
            setPermissions((current) => [
              ...current,
              {
                id: event.id,
                input: event.input,
                name: event.name,
                reason: event.reason,
              },
            ]);
            return;
          }
          setEntries((current) => fold(current, event));
        }
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            inflight.current = null;
            setIsRunning(false);
            setPermissions([]);

            if (exit._tag === "Failure") {
              setError(causeMessage(exit.cause));
              return;
            }

            if (exit.value.sessionId !== null) {
              setSessionId(exit.value.sessionId);
            }
            if (exit.value.context !== null) {
              setContext(exit.value.context);
            }
            setError(exit.value.failure?.message ?? null);
          })
        )
      );

      inflight.current = Effect.runFork(turn);
    },
    [cwd, effort, model, onSession, sessionId, storedId]
  );

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({
      answer,
      context,
      entries,
      error,
      isRunning,
      permission: permissions[0] ?? null,
      send,
      stop,
    }),
    [answer, context, entries, error, isRunning, permissions, send, stop]
  );
}
