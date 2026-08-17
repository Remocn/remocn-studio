"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { answerPermission, promptClaude } from "@/lib/studio/claude";
import { loadTranscript } from "@/lib/studio/history";
import type { PermissionAction } from "@/lib/studio/permission";
import type { SidecarError } from "@/lib/studio/sidecar";
import {
  dropQueued,
  enqueue,
  IDLE_TURN,
  nextQueued,
  type QueuedMessage,
  type TurnState,
} from "@/lib/studio/turns";
import type {
  EffortLevel,
  HistorySession,
  PromptAttachment,
  PromptElement,
  PromptFrame,
  PromptMedia,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";
import { appendUser, fold } from "@/shared/transcript";

export interface StartTurn {
  assets: readonly PromptAsset[];
  attachments: readonly PromptAttachment[];
  effort: EffortLevel | null;
  elements: readonly PromptElement[];
  historyId: string;
  media: readonly PromptMedia[];
  mode: SessionMode;
  model: string | null;
  playing: PromptFrame | null;
  projectId: string;
  prompt: string;
}

export interface Turns {
  answerTurn: (
    historyId: string,
    permissionId: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void;
  hasRunningTurns: boolean;
  loadTurn: (session: HistorySession) => void;
  markOpen: (historyId: string | null) => void;
  removeQueued: (historyId: string, id: string) => void;
  sendTurn: (input: StartTurn) => boolean;
  setTurnMode: (historyId: string, mode: SessionMode) => void;
  stopTurn: (historyId: string) => void;
  turns: ReadonlyMap<string, TurnState>;
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
  };
}

function startOf(
  message: QueuedMessage,
  historyId: string,
  mode: SessionMode
): StartTurn {
  return {
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
  };
}

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

  const loadTurn = useCallback(
    (session: HistorySession) => {
      if (snapshot.current.has(session.id)) {
        return;
      }

      update(session.id, (turn) => ({
        ...turn,
        isLoading: true,
        mode: session.mode,
        sdkSessionId: session.sdkSessionId,
      }));

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
      const started = snapshot.current.get(historyId) ?? IDLE_TURN;

      update(historyId, (current) => ({
        ...current,
        entries: appendUser(current.entries, {
          assets: input.assets,
          attachments: input.attachments,
          elements: input.elements,
          media: input.media,
          text: trimmed,
        }),
        error: null,
        isRunning: true,
        startedAt: Date.now(),
        unread: false,
      }));

      const request = promptClaude(
        {
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
          sessionId: started.sdkSessionId,
        },
        (event) => {
          if (event.type === "session") {
            update(historyId, (current) => ({
              ...current,
              mode: event.mode ?? current.mode,
              sdkSessionId: event.sessionId,
            }));
            return;
          }
          if (event.type === "history") {
            update(historyId, (current) => ({
              ...current,
              mode: event.session.mode,
            }));
            onSession(event.session);
            return;
          }
          if (event.type === "permission") {
            update(historyId, (current) => ({
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
            const hasFailed =
              exit._tag === "Failure" || exit.value.failure !== null;
            const before = snapshot.current.get(historyId) ?? IDLE_TURN;
            const head = nextQueued(before, hasFailed);

            update(historyId, (current) => {
              const settled = {
                ...(head === null ? current : dropQueued(current, head.id)),
                isRunning: false,
                permissions: [],
                startedAt: null,
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

            if (head !== null) {
              launcher.current(startOf(head, historyId, before.mode));
            }
          })
        )
      );

      fibers.current.set(historyId, Effect.runFork(request));
    },
    [onSession, update]
  );

  launcher.current = launch;

  const sendTurn = useCallback(
    (input: StartTurn): boolean => {
      if (isBlank(input)) {
        return false;
      }

      if (fibers.current.has(input.historyId)) {
        update(input.historyId, (current) =>
          enqueue(current, queuedOf(input, crypto.randomUUID()))
        );
        return true;
      }

      launch(input);
      return true;
    },
    [launch, update]
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

  const hasRunningTurns = useMemo(
    () => [...turns.values()].some((turn) => turn.isRunning),
    [turns]
  );

  return useMemo(
    () => ({
      answerTurn,
      hasRunningTurns,
      loadTurn,
      markOpen,
      removeQueued,
      sendTurn,
      setTurnMode,
      stopTurn,
      turns,
    }),
    [
      answerTurn,
      hasRunningTurns,
      loadTurn,
      markOpen,
      removeQueued,
      sendTurn,
      setTurnMode,
      stopTurn,
      turns,
    ]
  );
}
