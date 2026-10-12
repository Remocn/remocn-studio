"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  answerPermission,
  answerSourceAsset,
  promptAgent,
} from "@/lib/studio/agent";
import { loadTranscript, recordMessage } from "@/lib/studio/history";
import type { PermissionAction } from "@/lib/studio/permission";
import { loadPipeline } from "@/lib/studio/pipeline";
import { appendLive } from "@/lib/studio/reasoning";
import type { SidecarError } from "@/lib/studio/sidecar";
import {
  dropQueued,
  enqueue,
  IDLE_TURN,
  idleBeyond,
  nextQueued,
  type QueuedMessage,
  type TurnState,
  waitingSibling,
} from "@/lib/studio/turns";
import type {
  AgentEvent,
  EffortLevel,
  HistorySession,
  PromptAttachment,
  PromptElement,
  PromptFrame,
  PromptMedia,
  PromptResult,
  SessionMode,
  SourceAssetAction,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";
import type { AgentProvider } from "@/shared/providers";
import { appendUser, fold } from "@/shared/transcript";

export interface StartTurn {
  assets: readonly PromptAsset[];
  attachments: readonly PromptAttachment[];
  brandRevision?: number;
  effort: EffortLevel | null;
  elements: readonly PromptElement[];
  historyId: string;
  media: readonly PromptMedia[];
  mode: SessionMode;
  model: string | null;
  playing: PromptFrame | null;
  projectId: string;
  prompt: string;
  shaderPreparation?: { revision: string; provider: AgentProvider };
  videoId: string;
}

export interface TurnActions {
  answerSourceTurn: (
    historyId: string,
    sourceId: string,
    action: SourceAssetAction,
    file: string | null
  ) => Promise<boolean>;
  answerTurn: (
    historyId: string,
    permissionId: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void;
  hasRunningTurns: boolean;
  isVideoBusy: (videoId: string) => boolean;
  loadTurn: (session: HistorySession) => void;
  markOpen: (historyId: string | null) => void;
  // A message that asks the agent for nothing — every change went into the
  // code — still belongs in the transcript, so it is written there and no turn
  // is started.
  recordTurn: (input: StartTurn) => Promise<boolean>;
  removeQueued: (historyId: string, id: string) => void;
  sendTurn: (input: StartTurn) => boolean;
  setTurnMode: (historyId: string, mode: SessionMode) => void;
  setTurnProvider: (historyId: string, provider: AgentProvider) => void;
  stopTurn: (historyId: string) => void;
}

export interface Turns extends TurnActions {
  actions: TurnActions;
  turns: ReadonlyMap<string, TurnState>;
}

type Step = (turn: TurnState) => TurnState;

const KEPT_CHATS = 5;

const DEFERRED: ReadonlySet<AgentEvent["type"]> = new Set(["text", "thinking"]);

function stepOf(event: AgentEvent): Step {
  if (event.type === "pipeline") {
    return (current) => ({ ...current, stages: event.stages });
  }
  if (event.type === "permission") {
    return (current) => ({
      ...current,
      permissions: [
        ...current.permissions,
        {
          askedAt: Date.now(),
          id: event.id,
          input: event.input,
          name: event.name,
          reason: event.reason,
        },
      ],
    });
  }
  if (event.type === "asset_source") {
    return (current) => ({
      ...current,
      sources: [
        ...current.sources,
        {
          askedAt: Date.now(),
          attempt: event.attempt,
          id: event.id,
          name: event.name,
          source: event.source,
        },
      ],
    });
  }
  if (event.type === "thinking") {
    return (current) => ({
      ...current,
      live: appendLive(current.live, event),
    });
  }
  return (current) => ({
    ...current,
    entries: fold(current.entries, event),
    live: appendLive(current.live, event),
  });
}

type Running = Fiber.Fiber<PromptResult, SidecarError>;

function isBlank(input: StartTurn): boolean {
  return (
    input.prompt.trim().length === 0 &&
    input.attachments.length === 0 &&
    input.elements.length === 0 &&
    input.media.length === 0 &&
    input.assets.length === 0
  );
}

function queuedOf(input: StartTurn, id: string): QueuedMessage {
  return {
    ...(input.brandRevision === undefined
      ? {}
      : { brandRevision: input.brandRevision }),
    assets: input.assets,
    attachments: input.attachments,
    effort: input.effort,
    elements: input.elements,
    id,
    media: input.media,
    model: input.model,
    playing: input.playing,
    projectId: input.projectId,
    text: input.prompt,
    videoId: input.videoId,
  };
}

function startOf(
  message: QueuedMessage,
  historyId: string,
  mode: SessionMode
): StartTurn {
  return {
    ...(message.brandRevision === undefined
      ? {}
      : { brandRevision: message.brandRevision }),
    assets: message.assets,
    attachments: message.attachments,
    effort: message.effort,
    elements: message.elements,
    historyId,
    media: message.media,
    mode,
    model: message.model,
    playing: message.playing,
    projectId: message.projectId,
    prompt: message.text,
    videoId: message.videoId,
  };
}

export function useTurns(onSession: (session: HistorySession) => void): Turns {
  const [turns, setTurns] = useState<ReadonlyMap<string, TurnState>>(
    () => new Map()
  );
  const snapshot = useRef(turns);
  const fibers = useRef(new Map<string, Running>());
  const videos = useRef(new Map<string, string>());
  const open = useRef<string | null>(null);

  const videoFor = useCallback(
    (historyId: string) => videos.current.get(historyId) ?? null,
    []
  );

  const isVideoBusy = useCallback((videoId: string) => {
    for (const historyId of fibers.current.keys()) {
      if (videos.current.get(historyId) === videoId) {
        return true;
      }
    }
    return false;
  }, []);

  const deferred = useRef<[string, Step][]>([]);
  const frame = useRef<number | null>(null);
  const recent = useRef<readonly string[]>([]);
  const loaded = useRef(new Set<string>());

  const commit = useCallback((steps: readonly [string, Step][]) => {
    setTurns((current) => {
      const next = new Map(current);
      for (const [historyId, step] of steps) {
        next.set(historyId, step(next.get(historyId) ?? IDLE_TURN));
      }
      snapshot.current = next;
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const steps = deferred.current;
    if (steps.length === 0) {
      return;
    }
    deferred.current = [];
    commit(steps);
  }, [commit]);

  const update = useCallback(
    (historyId: string, step: Step) => {
      flush();
      commit([[historyId, step]]);
    },
    [commit, flush]
  );

  const defer = useCallback(
    (historyId: string, step: Step) => {
      deferred.current.push([historyId, step]);
      frame.current ??= requestAnimationFrame(flush);
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    },
    []
  );

  const release = useCallback((keep: string | null) => {
    const stale = idleBeyond(
      snapshot.current,
      recent.current,
      loaded.current,
      keep,
      KEPT_CHATS
    );
    if (stale.length === 0) {
      return;
    }

    for (const historyId of stale) {
      loaded.current.delete(historyId);
    }
    recent.current = recent.current.filter((id) => !stale.includes(id));

    setTurns((current) => {
      const next = new Map(current);
      for (const historyId of stale) {
        next.delete(historyId);
      }
      snapshot.current = next;
      return next;
    });
  }, []);

  const markOpen = useCallback(
    (historyId: string | null) => {
      open.current = historyId;
      if (historyId !== null) {
        recent.current = [
          historyId,
          ...recent.current.filter((id) => id !== historyId),
        ];
      }
      release(historyId);
      if (historyId !== null && snapshot.current.get(historyId)?.unread) {
        update(historyId, (turn) => ({ ...turn, unread: false }));
      }
    },
    [release, update]
  );

  const loadTurn = useCallback(
    (session: HistorySession) => {
      if (snapshot.current.has(session.id)) {
        return;
      }

      loaded.current.add(session.id);

      update(session.id, (turn) => ({
        ...turn,
        isLoading: true,
        mode: session.mode,
        provider: session.provider,
        sdkSessionId: session.sdkSessionId,
      }));

      Effect.runFork(
        loadPipeline(session.id).pipe(
          Effect.tap((state) =>
            Effect.sync(() =>
              update(session.id, (turn) => ({
                ...turn,
                // A turn started while this was in flight has already reported
                // the live stages; a reading taken before it must not undo them.
                stages: turn.stages.length > 0 ? turn.stages : state.stages,
              }))
            )
          ),
          Effect.ignore
        )
      );

      Effect.runFork(
        loadTranscript(session.id).pipe(
          Effect.tap((entries) =>
            Effect.sync(() =>
              update(session.id, (turn) => ({
                ...turn,
                entries: [...entries, ...turn.entries],
                isLoading: false,
              }))
            )
          ),
          Effect.catch((failure) =>
            Effect.sync(() =>
              update(session.id, (turn) => ({
                ...turn,
                error: failure.message,
                isLoading: false,
              }))
            )
          )
        )
      );
    },
    [update]
  );

  const setTurnMode = useCallback(
    (historyId: string, mode: SessionMode) => {
      update(historyId, (turn) => ({ ...turn, mode }));
    },
    [update]
  );

  const setTurnProvider = useCallback(
    (historyId: string, provider: AgentProvider) => {
      update(historyId, (turn) => ({ ...turn, provider }));
    },
    [update]
  );

  const stopTurn = useCallback((historyId: string) => {
    const fiber = fibers.current.get(historyId);
    if (fiber !== undefined) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const launcher = useRef<(input: StartTurn) => void>(() => undefined);

  const launch = useCallback(
    (input: StartTurn) => {
      const trimmed = input.prompt.trim();
      const { historyId } = input;
      const stored = snapshot.current.get(historyId) ?? IDLE_TURN;
      const started = input.shaderPreparation
        ? { ...stored, provider: input.shaderPreparation.provider }
        : stored;

      update(historyId, (current) => ({
        ...current,
        entries: appendUser(current.entries, {
          ...(input.brandRevision === undefined
            ? {}
            : { brandRevision: input.brandRevision }),
          assets: input.assets,
          attachments: input.attachments,
          elements: input.elements,
          media: input.media,
          text: trimmed,
        }),
        error: null,
        isRunning: true,
        live: [],
        provider: started.provider,
        startedAt: Date.now(),
        unread: false,
        workedMs: null,
      }));

      let row: HistorySession | null = null;

      const request = promptAgent(
        {
          ...(input.shaderPreparation
            ? {
                shaderPreparation: {
                  revision: input.shaderPreparation.revision,
                },
              }
            : {}),
          ...(input.brandRevision === undefined
            ? {}
            : { brandRevision: input.brandRevision }),
          assets: input.assets,
          attachments: input.attachments,
          effort: input.effort,
          elements: input.elements,
          historyId,
          media: input.media,
          mode: input.mode,
          model: input.model,
          playing: input.playing,
          projectId: input.projectId,
          prompt: trimmed,
          provider: started.provider,
          sessionId: started.sdkSessionId,
          videoId: input.videoId,
        },
        (event) => {
          if (event.type === "session") {
            update(historyId, (current) => ({
              ...current,
              mode: event.mode ?? current.mode,
              sdkSessionId: event.sessionId,
            }));
            if (row !== null && row.sdkSessionId !== event.sessionId) {
              row = { ...row, sdkSessionId: event.sessionId };
              onSession(row);
            }
            return;
          }
          if (event.type === "history") {
            row = event.session;
            update(historyId, (current) => ({
              ...current,
              mode: event.session.mode,
            }));
            onSession(event.session);
            return;
          }
          const step = stepOf(event);
          if (DEFERRED.has(event.type)) {
            defer(historyId, step);
          } else {
            update(historyId, step);
          }
        }
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            fibers.current.delete(historyId);
            const away = open.current !== historyId;
            const hasFailed =
              exit._tag === "Failure" || exit.value.failure !== null;
            const before = snapshot.current.get(historyId) ?? IDLE_TURN;
            const head = nextQueued(before, hasFailed);

            update(historyId, (current) => {
              const settled = {
                ...(head === null ? current : dropQueued(current, head.id)),
                isRunning: false,
                live: [],
                permissions: [],
                sources: [],
                startedAt: null,
                unread: away,
                workedMs:
                  current.startedAt === null
                    ? null
                    : Date.now() - current.startedAt,
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

            if (head !== null) {
              launcher.current(startOf(head, historyId, before.mode));
              return;
            }

            // Nothing of ours to send, so the video is free: hand it to a
            // sibling chat that has been holding a message for it.
            const sibling = waitingSibling(
              snapshot.current,
              videoFor,
              videos.current.get(historyId) ?? null,
              historyId
            );
            if (sibling !== null) {
              update(sibling.historyId, (current) =>
                dropQueued(current, sibling.message.id)
              );
              launcher.current(
                startOf(
                  sibling.message,
                  sibling.historyId,
                  snapshot.current.get(sibling.historyId)?.mode ?? before.mode
                )
              );
            }
          })
        )
      );

      videos.current.set(historyId, input.videoId);
      fibers.current.set(historyId, Effect.runFork(request));
    },
    [defer, onSession, update, videoFor]
  );

  launcher.current = launch;

  const sendTurn = useCallback(
    (input: StartTurn): boolean => {
      if (isBlank(input)) {
        return false;
      }

      // The resource two chats fight over is the video's folder, not the SDK
      // session, so one turn at a time is per video and the queue is what
      // makes the wait visible.
      videos.current.set(input.historyId, input.videoId);

      if (isVideoBusy(input.videoId)) {
        if (input.shaderPreparation) {
          return false;
        }
        update(input.historyId, (current) =>
          enqueue(current, queuedOf(input, crypto.randomUUID()))
        );
        return true;
      }

      launch(input);
      return true;
    },
    [isVideoBusy, launch, update]
  );

  const recordTurn = useCallback(
    async (input: StartTurn): Promise<boolean> => {
      const trimmed = input.prompt.trim();
      const { historyId } = input;
      const started = snapshot.current.get(historyId) ?? IDLE_TURN;

      update(historyId, (current) => ({
        ...current,
        entries: appendUser(current.entries, {
          ...(input.brandRevision === undefined
            ? {}
            : { brandRevision: input.brandRevision }),
          assets: input.assets,
          attachments: input.attachments,
          elements: input.elements,
          media: input.media,
          text: trimmed,
        }),
        error: null,
        unread: false,
      }));

      videos.current.set(historyId, input.videoId);

      const exit = await Effect.runPromiseExit(
        recordMessage({
          ...(input.brandRevision === undefined
            ? {}
            : { brandRevision: input.brandRevision }),
          assets: input.assets,
          attachments: input.attachments,
          effort: input.effort,
          elements: input.elements,
          historyId,
          media: input.media,
          mode: input.mode,
          model: input.model,
          playing: input.playing,
          projectId: input.projectId,
          prompt: trimmed,
          provider: started.provider,
          sessionId: started.sdkSessionId,
          videoId: input.videoId,
        })
      );

      if (exit._tag === "Failure") {
        update(historyId, (current) => ({
          ...current,
          error: causeMessage(exit.cause),
        }));
        return true;
      }

      if (exit.value.session !== null) {
        onSession(exit.value.session);
      }

      return true;
    },
    [onSession, update]
  );

  const removeQueued = useCallback(
    (historyId: string, id: string) => {
      update(historyId, (current) => dropQueued(current, id));
    },
    [update]
  );

  const answerTurn = useCallback(
    (
      historyId: string,
      permissionId: string,
      action: PermissionAction,
      mode: SessionMode | null
    ) => {
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
        answerPermission({ decision: action, id: permissionId, mode }).pipe(
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

  const answerSourceTurn = useCallback(
    async (
      historyId: string,
      sourceId: string,
      action: SourceAssetAction,
      file: string | null
    ): Promise<boolean> => {
      try {
        const result = await Effect.runPromise(
          answerSourceAsset({ action, file, id: sourceId })
        );
        if (result.matched) {
          update(historyId, (turn) => ({
            ...turn,
            error: null,
            sources: turn.sources.filter((pending) => pending.id !== sourceId),
          }));
        }
        return result.matched;
      } catch (failure) {
        update(historyId, (turn) => ({
          ...turn,
          error: failure instanceof Error ? failure.message : String(failure),
        }));
        throw failure;
      }
    },
    [update]
  );

  const hasRunningTurns = useMemo(
    () => [...turns.values()].some((turn) => turn.isRunning),
    [turns]
  );

  const actions = useMemo(
    () => ({
      answerSourceTurn,
      answerTurn,
      hasRunningTurns,
      isVideoBusy,
      loadTurn,
      markOpen,
      recordTurn,
      removeQueued,
      sendTurn,
      setTurnMode,
      setTurnProvider,
      stopTurn,
    }),
    [
      answerSourceTurn,
      answerTurn,
      hasRunningTurns,
      isVideoBusy,
      loadTurn,
      markOpen,
      recordTurn,
      removeQueued,
      sendTurn,
      setTurnMode,
      setTurnProvider,
      stopTurn,
    ]
  );

  return useMemo(() => ({ ...actions, actions, turns }), [actions, turns]);
}
