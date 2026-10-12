"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  type CodeWriteSettings,
  type CodeWrites,
  useCodeWrites,
} from "@/hooks/use-code-writes";
import type { Selection } from "@/hooks/use-selections";
import type { TurnActions } from "@/hooks/use-turns";
import { gatheredAsks, type PermissionAction } from "@/lib/studio/permission";
import type { LiveLine } from "@/lib/studio/reasoning";
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
  playing: () => PromptFrame | null;
  projectId: string | null;
  session: HistorySession | null;
  startSession?: (id?: string) => void;
  states: ReadonlyMap<string, TurnState>;
  turns: TurnActions;
  videoId: string | null;
  /** The code write, injected so a test can answer without a sidecar. */
  writeCode?: CodeWriteSettings["write"];
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
  asks: readonly PendingPermission[];
  canPickProvider: boolean;
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  isLoadingTranscript: boolean;
  isRunning: boolean;
  live: readonly LiveLine[];
  mode: SessionMode;
  onModeChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  openId: string;
  permission: PendingPermission | null;
  prepareShader?: (revision: string) => boolean;
  provider: AgentProvider;
  queue: readonly QueuedMessage[];
  removeQueued: (id: string) => void;
  send: (
    prompt: string,
    attachments?: readonly PromptAttachment[],
    selections?: readonly Selection[],
    assets?: readonly PromptAsset[],
    media?: readonly PromptMedia[]
  ) => Promise<boolean>;
  source: PendingSourceAsset | null;
  stages: readonly PipelineStage[];
  startedAt: number | null;
  stop: () => void;
  turnError: string | null;
  workedMs: number | null;
  writes: CodeWrites;
  /** Why a message carrying code edits cannot go out yet, or nothing. */
  writesBlocked: string | null;
}

export function useOpenTurn({
  changeMode,
  startSession,
  draftId,
  effort,
  models,
  playing,
  projectId,
  session,
  states,
  turns,
  videoId,
  writeCode,
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
  const turn: TurnState = states.get(openId) ?? IDLE_TURN;

  useEffect(() => {
    markOpen(openId);
  }, [markOpen, openId]);

  useEffect(() => {
    if (session !== null) {
      loadTurn(session);
    }
  }, [loadTurn, session]);

  const writes = useCodeWrites({ projectId, write: writeCode });
  const { isVideoBusy, recordTurn } = turns;

  // One turn at a time is already per video; a write is stricter, because it
  // touches the same files the running turn is editing. There is no queue for
  // it — the message waits in the composer with the reason on the button.
  const writesBlocked =
    videoId !== null && isVideoBusy(videoId)
      ? "This video has a turn running, so the studio will not write to its files yet."
      : null;

  const runWrites = writes.run;

  const send = useCallback(
    async (
      prompt: string,
      attachments: readonly PromptAttachment[] = [],
      selections: readonly Selection[] = [],
      assets: readonly PromptAsset[] = [],
      media: readonly PromptMedia[] = []
    ): Promise<boolean> => {
      if (projectId === null || videoId === null) {
        return false;
      }

      const writing = selections.some(
        (selection) => selection.writes.length > 0
      );

      if (writing && writesBlocked !== null) {
        return false;
      }

      const outcome = writing
        ? await runWrites(selections)
        : { failed: new Set<number>(), ok: true, written: [] };

      if (!outcome.ok) {
        return false;
      }

      // A chip whose edits were refused is no longer a record of what the
      // studio did — it becomes a request, and the agent is asked for it.
      const elements: readonly PromptElement[] = selections.map(
        (selection, index) =>
          outcome.failed.has(index)
            ? { ...selection.element, written: false }
            : selection.element
      );

      const model = models[turn.provider];
      const input = {
        assets,
        attachments,
        effort,
        elements,
        historyId: openId,
        media,
        mode: turn.mode,
        model: model.length === 0 ? null : model,
        playing: playing(),
        projectId,
        prompt,
        videoId,
      };

      // Nothing left to ask for: every change went into the code, and the
      // message is a record rather than a request.
      const asks =
        prompt.trim().length > 0 ||
        attachments.length > 0 ||
        assets.length > 0 ||
        media.length > 0 ||
        elements.some((element) => element.written !== true);

      return asks ? sendTurn(input) : await recordTurn(input);
    },
    [
      effort,
      models,
      openId,
      playing,
      projectId,
      recordTurn,
      runWrites,
      sendTurn,
      turn.mode,
      turn.provider,
      videoId,
      writesBlocked,
    ]
  );

  const prepareShader = useCallback(
    (revision: string) => {
      if (!(projectId && videoId && startSession) || isVideoBusy(videoId)) {
        return false;
      }
      const historyId = crypto.randomUUID();
      const sent = sendTurn({
        assets: [],
        attachments: [],
        effort,
        elements: [],
        historyId,
        media: [],
        mode: turn.mode,
        model: models[turn.provider] || null,
        playing: playing(),
        projectId,
        prompt:
          "Prepare this video for scene shaders. Preserve its content, timing, transitions and Inspect properties. Do not insert a shader yet.",
        shaderPreparation: { provider: turn.provider, revision },
        videoId,
      });
      if (sent) {
        startSession(historyId);
      }
      return sent;
    },
    [
      projectId,
      videoId,
      startSession,
      isVideoBusy,
      sendTurn,
      effort,
      turn.mode,
      turn.provider,
      models,
      playing,
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
      asks: gatheredAsks(turn.permissions),
      canPickProvider,
      context: turn.context,
      entries: turn.entries,
      isLoadingTranscript: turn.isLoading,
      isRunning: turn.isRunning,
      live: turn.live,
      mode: turn.mode,
      onModeChange,
      onProviderChange,
      openId,
      permission: turn.permissions[0] ?? null,
      prepareShader,
      provider: turn.provider,
      queue: turn.queue,
      removeQueued,
      send,
      source: turn.sources[0] ?? null,
      stages: turn.stages,
      startedAt: turn.startedAt,
      stop,
      turnError: turn.error,
      workedMs: turn.workedMs,
      writes,
      writesBlocked,
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
      prepareShader,
      stop,
      turn,
      writes,
      writesBlocked,
    ]
  );
}
