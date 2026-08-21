"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { Turns } from "@/hooks/use-turns";
import type { PermissionAction } from "@/lib/studio/permission";
import {
  IDLE_TURN,
  type PendingPermission,
  type PendingSourceAsset,
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
  type SourceAssetAction,
  type TranscriptEntry,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import { type AgentProvider, isAgentProvider } from "@/shared/providers";

export interface OpenTurnSettings {
  changeMode: (historyId: string, mode: SessionMode) => void;
  draftId: string;
  effort: EffortLevel | null;
  models: Record<AgentProvider, string>;
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
  answerSource: (
    sourceId: string,
    action: SourceAssetAction,
    file: string | null
  ) => Promise<boolean>;
  canPickProvider: boolean;
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  isLoadingTranscript: boolean;
  isRunning: boolean;
  mode: SessionMode;
  onModeChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  openId: string;
  permission: PendingPermission | null;
  provider: AgentProvider;
  queue: readonly QueuedMessage[];
  removeQueued: (id: string) => void;
  send: (
    prompt: string,
    attachments?: readonly PromptAttachment[],
    elements?: readonly PromptElement[],
    assets?: readonly PromptAsset[],
    media?: readonly PromptMedia[]
  ) => boolean;
  source: PendingSourceAsset | null;
  stages: readonly PipelineStage[];
  startedAt: number | null;
  stop: () => void;
  turnError: string | null;
}

export function useOpenTurn({
  changeMode,
  draftId,
  effort,
  models,
  playing,
  projectId,
  session,
  turns,
}: OpenTurnSettings): OpenTurn {
  const openId = session?.id ?? draftId;
  const {
    answerSourceTurn,
    answerTurn,
    loadTurn,
    markOpen,
    sendTurn,
    stopTurn,
  } = turns;
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
      const model = models[turn.provider];
      return sendTurn({
        assets,
        attachments,
        effort,
        elements,
        historyId: openId,
        media,
        mode: turn.mode,
        model: model.length === 0 ? null : model,
        playing,
        projectId,
        prompt,
      });
    },
    [
      effort,
      models,
      openId,
      playing,
      projectId,
      sendTurn,
      turn.mode,
      turn.provider,
    ]
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

  const answerSource = useCallback(
    (sourceId: string, action: SourceAssetAction, file: string | null) =>
      answerSourceTurn(openId, sourceId, action, file),
    [answerSourceTurn, openId]
  );

  const onModeChange = useCallback(
    (value: string) => {
      if (isSessionMode(value)) {
        changeMode(openId, value);
      }
    },
    [changeMode, openId]
  );

  // The provider is picked once, for a session that has not spoken yet:
  // resume tokens are not portable, so a session with any history keeps the
  // provider it started with, and changing it means starting a new session.
  const canPickProvider =
    session === null &&
    turn.entries.length === 0 &&
    turn.sdkSessionId === null &&
    !turn.isRunning;

  const setProvider = turns.setTurnProvider;
  const onProviderChange = useCallback(
    (value: string) => {
      if (isAgentProvider(value)) {
        setProvider(openId, value);
      }
    },
    [openId, setProvider]
  );

  return useMemo(
    () => ({
      answer,
      answerSource,
      canPickProvider,
      context: turn.context,
      entries: turn.entries,
      isLoadingTranscript: turn.isLoading,
      isRunning: turn.isRunning,
      mode: turn.mode,
      onModeChange,
      onProviderChange,
      openId,
      permission: turn.permissions[0] ?? null,
      provider: turn.provider,
      queue: turn.queue,
      removeQueued,
      send,
      source: turn.sources[0] ?? null,
      stages: turn.stages,
      startedAt: turn.startedAt,
      stop,
      turnError: turn.error,
    }),
    [
      answerSource,
      answer,
      canPickProvider,
      onModeChange,
      onProviderChange,
      openId,
      removeQueued,
      send,
      stop,
      turn,
    ]
  );
}
