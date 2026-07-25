"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { answerPermission, promptClaude } from "@/lib/studio/claude";
import type { PermissionAction } from "@/lib/studio/permission";
import type { SidecarError } from "@/lib/studio/sidecar";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import type {
  EffortLevel,
  HistorySession,
  PromptAttachment,
  PromptResult,
  TranscriptEntry,
} from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";

export interface StartTurn {
  attachments: readonly PromptAttachment[];
  effort: EffortLevel | null;
  historyId: string;
  model: string | null;
  projectId: string;
  prompt: string;
}

export interface Turns {
  answerTurn: (
    historyId: string,
    permissionId: string,
    action: PermissionAction
  ) => void;
  hasRunningTurns: boolean;
  markOpen: (historyId: string | null) => void;
  seedTurn: (
    historyId: string,
    entries: readonly TranscriptEntry[],
    sdkSessionId: string | null
  ) => void;
  sendTurn: (input: StartTurn) => void;
  stopTurn: (historyId: string) => void;
  turns: ReadonlyMap<string, TurnState>;
}

type Running = Fiber.Fiber<PromptResult, SidecarError>;

export function useTurns(onSession: (session: HistorySession) => void): Turns {
  const [turns, setTurns] = useState<ReadonlyMap<string, TurnState>>(
    () => new Map()
  );
  const snapshot = useRef(turns);
  const fibers = useRef(new Map<string, Running>());
  const open = useRef<string | null>(null);

  const update = useCallback(
    (historyId: string, step: (turn: TurnState) => TurnState) => {
      setTurns((current) => {
        const next = new Map(current);
        next.set(historyId, step(current.get(historyId) ?? IDLE_TURN));
        snapshot.current = next;
        return next;
      });
    },
    []
  );

  const markOpen = useCallback(
    (historyId: string | null) => {
      open.current = historyId;
      if (historyId !== null && snapshot.current.get(historyId)?.unread) {
        update(historyId, (turn) => ({ ...turn, unread: false }));
      }
    },
    [update]
  );

  const seedTurn = useCallback(
    (
      historyId: string,
      entries: readonly TranscriptEntry[],
      sdkSessionId: string | null
    ) => {
      if (snapshot.current.has(historyId)) {
        return;
      }
      update(historyId, (turn) => ({ ...turn, entries, sdkSessionId }));
    },
    [update]
  );

  const stopTurn = useCallback((historyId: string) => {
    const fiber = fibers.current.get(historyId);
    if (fiber !== undefined) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const sendTurn = useCallback(
    (input: StartTurn) => {
      const trimmed = input.prompt.trim();
      const isEmpty = trimmed.length === 0 && input.attachments.length === 0;
      if (isEmpty || fibers.current.has(input.historyId)) {
        return;
      }

      const { historyId } = input;
      const started = snapshot.current.get(historyId) ?? IDLE_TURN;

      update(historyId, (current) => ({
        ...current,
        entries: appendUser(current.entries, {
          attachments: input.attachments,
          text: trimmed,
        }),
        error: null,
        isRunning: true,
        unread: false,
      }));

      const request = promptClaude(
        {
          attachments: input.attachments,
          effort: input.effort,
          historyId,
          model: input.model,
          projectId: input.projectId,
          prompt: trimmed,
          sessionId: started.sdkSessionId,
        },
        (event) => {
          if (event.type === "session") {
            update(historyId, (current) => ({
              ...current,
              sdkSessionId: event.sessionId,
            }));
            return;
          }
          if (event.type === "history") {
            onSession(event.session);
            return;
          }
          if (event.type === "permission") {
            update(historyId, (current) => ({
              ...current,
              permissions: [
                ...current.permissions,
                {
                  id: event.id,
                  input: event.input,
                  name: event.name,
                  reason: event.reason,
                },
              ],
            }));
            return;
          }
          update(historyId, (current) => ({
            ...current,
            entries: fold(current.entries, event),
          }));
        }
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            fibers.current.delete(historyId);
            const away = open.current !== historyId;

            update(historyId, (current) => {
              const settled = {
                ...current,
                isRunning: false,
                permissions: [],
                unread: away,
              };

              if (exit._tag === "Failure") {
                return { ...settled, error: causeMessage(exit.cause) };
              }

              return {
                ...settled,
                context: exit.value.context ?? current.context,
                error: exit.value.failure?.message ?? null,
                sdkSessionId: exit.value.sessionId ?? current.sdkSessionId,
              };
            });
          })
        )
      );

      fibers.current.set(historyId, Effect.runFork(request));
    },
    [onSession, update]
  );

  const answerTurn = useCallback(
    (historyId: string, permissionId: string, action: PermissionAction) => {
      if (action === "cancel") {
        stopTurn(historyId);
        return;
      }

      update(historyId, (turn) => ({
        ...turn,
        permissions: turn.permissions.filter(
          (pending) => pending.id !== permissionId
        ),
      }));

      Effect.runFork(
        answerPermission({ decision: action, id: permissionId }).pipe(
          Effect.catch((failure) =>
            Effect.sync(() =>
              update(historyId, (turn) => ({
                ...turn,
                error: failure.message,
              }))
            )
          )
        )
      );
    },
    [stopTurn, update]
  );

  const hasRunningTurns = useMemo(
    () => [...turns.values()].some((turn) => turn.isRunning),
    [turns]
  );

  return useMemo(
    () => ({
      answerTurn,
      hasRunningTurns,
      markOpen,
      seedTurn,
      sendTurn,
      stopTurn,
      turns,
    }),
    [answerTurn, hasRunningTurns, markOpen, seedTurn, sendTurn, stopTurn, turns]
  );
}
