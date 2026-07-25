"use client";

import { Effect } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, removeSession } from "@/lib/studio/history";
import type { HistorySession } from "@/shared/ipc";

export interface StudioSessions {
  activeSession: HistorySession | null;
  forgetSessionsOf: (projectId: string) => void;
  isLoadingSessions: boolean;
  isThinking: boolean;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  openedSession: HistorySession | null;
  reloadSessions: () => void;
  rememberSession: (session: HistorySession) => void;
  reportThinking: (isThinking: boolean) => void;
  selectSession: (session: HistorySession) => void;
  sessionKey: string;
  sessions: readonly HistorySession[];
  sessionsError: string | null;
  startSession: () => void;
}

export function useSessions(): StudioSessions {
  const [sessions, setSessions] = useState<readonly HistorySession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isThinking, setIsThinking] = useState(false);

  const reloadSessions = useCallback(() => {
    setIsLoadingSessions(true);

    Effect.runFork(
      listSessions.pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            setSessions(rows);
            setSessionsError(null);
          })
        ),
        Effect.catch((failure) =>
          Effect.sync(() => setSessionsError(failure.message))
        ),
        Effect.ensuring(Effect.sync(() => setIsLoadingSessions(false)))
      )
    );
  }, []);

  useEffect(reloadSessions, [reloadSessions]);

  const startSession = useCallback(() => {
    setActiveId(null);
    setOpenedId(null);
    setSessionKey(crypto.randomUUID());
  }, []);

  const selectSession = useCallback((session: HistorySession) => {
    setActiveId(session.id);
    setOpenedId(session.id);
    setSessionKey(crypto.randomUUID());
  }, []);

  const rememberSession = useCallback((session: HistorySession) => {
    setSessions((current) => [
      session,
      ...current.filter((row) => row.id !== session.id),
    ]);
    setActiveId((current) => current ?? session.id);
  }, []);

  const forgetSessionsOf = useCallback(
    (projectId: string) => {
      const open = sessions.some(
        (row) =>
          row.projectId === projectId &&
          (row.id === activeId || row.id === openedId)
      );

      setSessions((current) =>
        current.filter((row) => row.projectId !== projectId)
      );

      if (open) {
        startSession();
      }
    },
    [activeId, openedId, sessions, startSession]
  );

  const onRemoveSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.value;

      setSessions((current) => current.filter((row) => row.id !== id));
      if (activeId === id) {
        startSession();
      }

      Effect.runFork(
        removeSession(id).pipe(
          Effect.catch((failure) =>
            Effect.sync(() => setSessionsError(failure.message))
          )
        )
      );
    },
    [activeId, startSession]
  );

  return useMemo(
    () => ({
      activeSession: sessions.find((row) => row.id === activeId) ?? null,
      forgetSessionsOf,
      isLoadingSessions,
      isThinking,
      onRemoveSession,
      openedSession: sessions.find((row) => row.id === openedId) ?? null,
      reloadSessions,
      rememberSession,
      reportThinking: setIsThinking,
      selectSession,
      sessionKey,
      sessions,
      sessionsError,
      startSession,
    }),
    [
      activeId,
      forgetSessionsOf,
      isLoadingSessions,
      isThinking,
      onRemoveSession,
      openedId,
      reloadSessions,
      rememberSession,
      selectSession,
      sessionKey,
      sessions,
      sessionsError,
      startSession,
    ]
  );
}
