"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { Turns } from "@/hooks/use-turns";
import type { PermissionAction } from "@/lib/studio/permission";
import {
  IDLE_TURN,
  type PendingPermission,
  type QueuedMessage,
  type TurnState,
} from "@/lib/studio/turns";
import {
  type ContextUsage,
  type EffortLevel,
  type HistorySession,
  isSessionMode,
  type PromptAttachment,
  type PromptElement,
  type PromptFrame,
  type PromptMedia,
  type SessionMode,
  type TranscriptEntry,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";

export interface OpenTurnSettings {
  changeMode: (historyId: string, mode: SessionMode) => void;
  draftId: string;
  effort: EffortLevel | null;
  model: string | null;
  playing: PromptFrame | null;
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
  queue: readonly QueuedMessage[];
  removeQueued: (id: string) => void;
  send: (
    prompt: string,
    attachments?: readonly PromptAttachment[],
    elements?: readonly PromptElement[],
    assets?: readonly PromptAsset[],
    media?: readonly PromptMedia[]
  ) => boolean;
  startedAt: number | null;
  stop: () => void;
  turnError: string | null;
}

export function useOpenTurn({
  changeMode,
  draftId,
  effort,
  model,
  playing,
  projectId,
  session,
  turns,
}: OpenTurnSettings): OpenTurn {
  const openId = session?.id ?? draftId;
  const { answerTurn, loadTurn, markOpen, sendTurn, stopTurn } = turns;
  const dropQueued = turns.removeQueued;
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
    (
      prompt: string,
      attachments: readonly PromptAttachment[] = [],
      elements: readonly PromptElement[] = [],
      assets: readonly PromptAsset[] = [],
      media: readonly PromptMedia[] = []
    ) => {
      if (projectId === null) {
        return false;
      }
      return sendTurn({
        assets,
        attachments,
        effort,
        elements,
        historyId: openId,
        media,
        mode: turn.mode,
        model,
        playing,
        projectId,
        prompt,
      });
    },
    [effort, model, openId, playing, projectId, sendTurn, turn.mode]
  );

  const stop = useCallback(() => stopTurn(openId), [openId, stopTurn]);

  const removeQueued = useCallback(
    (id: string) => dropQueued(openId, id),
    [dropQueued, openId]
  );

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
      queue: turn.queue,
      removeQueued,
      send,
      startedAt: turn.startedAt,
      stop,
      turnError: turn.error,
    }),
    [answer, onModeChange, openId, removeQueued, send, stop, turn]
  );
}
