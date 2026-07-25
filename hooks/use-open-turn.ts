"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { Turns } from "@/hooks/use-turns";
import type { PermissionAction } from "@/lib/studio/permission";
import {
  IDLE_TURN,
  type PendingPermission,
  type TurnState,
} from "@/lib/studio/turns";
import type {
  ContextUsage,
  EffortLevel,
  HistorySession,
  PromptAttachment,
  TranscriptEntry,
} from "@/shared/ipc";

export interface OpenTurnSettings {
  draftId: string;
  effort: EffortLevel | null;
  model: string | null;
  projectId: string | null;
  session: HistorySession | null;
  turns: Turns;
}

export interface OpenTurn {
  answer: (permissionId: string, action: PermissionAction) => void;
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  isLoadingTranscript: boolean;
  isRunning: boolean;
  openId: string;
  permission: PendingPermission | null;
  send: (prompt: string, attachments?: readonly PromptAttachment[]) => void;
  stop: () => void;
  turnError: string | null;
}

export function useOpenTurn({
  draftId,
  effort,
  model,
  projectId,
  session,
  turns,
}: OpenTurnSettings): OpenTurn {
  const openId = session?.id ?? draftId;
  const { answerTurn, loadTurn, markOpen, sendTurn, stopTurn } = turns;
  const turn: TurnState = turns.turns.get(openId) ?? IDLE_TURN;

  useEffect(() => {
    markOpen(openId);
  }, [markOpen, openId]);

  useEffect(() => {
    if (session !== null) {
      loadTurn(session);
    }
  }, [loadTurn, session]);

  const send = useCallback(
    (prompt: string, attachments: readonly PromptAttachment[] = []) => {
      if (projectId === null) {
        return;
      }
      sendTurn({
        attachments,
        effort,
        historyId: openId,
        model,
        projectId,
        prompt,
      });
    },
    [effort, model, openId, projectId, sendTurn]
  );

  const stop = useCallback(() => stopTurn(openId), [openId, stopTurn]);

  const answer = useCallback(
    (permissionId: string, action: PermissionAction) =>
      answerTurn(openId, permissionId, action),
    [answerTurn, openId]
  );

  return useMemo(
    () => ({
      answer,
      context: turn.context,
      entries: turn.entries,
      isLoadingTranscript: turn.isLoading,
      isRunning: turn.isRunning,
      openId,
      permission: turn.permissions[0] ?? null,
      send,
      stop,
      turnError: turn.error,
    }),
    [answer, openId, send, stop, turn]
  );
}
