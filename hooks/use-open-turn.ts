"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { Turns } from "@/hooks/use-turns";
import type { PermissionAction } from "@/lib/studio/permission";
import {
  IDLE_TURN,
  type PendingPermission,
  type TurnState,
} from "@/lib/studio/turns";
import {
  type ContextUsage,
  type EffortLevel,
  type HistorySession,
  isSessionMode,
  type PromptAttachment,
  type SessionMode,
  type TranscriptEntry,
} from "@/shared/ipc";

export interface OpenTurnSettings {
  changeMode: (historyId: string, mode: SessionMode) => void;
  draftId: string;
  effort: EffortLevel | null;
  model: string | null;
  projectId: string | null;
  session: HistorySession | null;
  turns: Turns;
}

export interface OpenTurn {
  answer: (
    permissionId: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void;
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  isLoadingTranscript: boolean;
  isRunning: boolean;
  mode: SessionMode;
  onModeChange: (value: string) => void;
  openId: string;
  permission: PendingPermission | null;
  send: (prompt: string, attachments?: readonly PromptAttachment[]) => void;
  stop: () => void;
  turnError: string | null;
}

export function useOpenTurn({
  changeMode,
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
        mode: turn.mode,
        model,
        projectId,
        prompt,
      });
    },
    [effort, model, openId, projectId, sendTurn, turn.mode]
  );

  const stop = useCallback(() => stopTurn(openId), [openId, stopTurn]);

  const answer = useCallback(
    (
      permissionId: string,
      action: PermissionAction,
      mode: SessionMode | null
    ) => answerTurn(openId, permissionId, action, mode),
    [answerTurn, openId]
  );

  const onModeChange = useCallback(
    (value: string) => {
      if (isSessionMode(value)) {
        changeMode(openId, value);
      }
    },
    [changeMode, openId]
  );

  return useMemo(
    () => ({
      answer,
      context: turn.context,
      entries: turn.entries,
      isLoadingTranscript: turn.isLoading,
      isRunning: turn.isRunning,
      mode: turn.mode,
      onModeChange,
      openId,
      permission: turn.permissions[0] ?? null,
      send,
      stop,
      turnError: turn.error,
    }),
    [answer, onModeChange, openId, send, stop, turn]
  );
}
