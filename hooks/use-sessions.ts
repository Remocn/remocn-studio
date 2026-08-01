"use client";

import { Duration, Effect, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { listSessions, removeSession } from "@/lib/studio/history";
import type { HistorySession } from "@/shared/ipc";

const UNDO_WINDOW = "10 seconds";

interface Held {
  fiber: Fiber.Fiber<void, never>;
  index: number;
  session: HistorySession;
  toastId: string;
  wasActive: boolean;
}

export interface StudioSessions {
  activeSession: HistorySession | null;
  draftId: string;
  forgetSessionsOf: (projectId: string) => void;
  isLoadingSessions: boolean;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  openedSession: HistorySession | null;
  reloadSessions: () => void;
  rememberSession: (session: HistorySession) => void;
  replaceSession: (session: HistorySession) => void;
  selectSession: (session: HistorySession) => void;
  sessions: readonly HistorySession[];
  sessionsError: string | null;
  startSession: () => void;
  undoRemoveSession: (sessionId: string) => void;
}

export function useSessions(
  undoWindow: Duration.Input = UNDO_WINDOW
): StudioSessions {
  const [sessions, setSessions] = useState<readonly HistorySession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const held = useRef(new Map<string, Held>());

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

  useEffect(() => {
    const holding = held.current;

    return () => {
      for (const pending of holding.values()) {
        Effect.runFork(Fiber.interrupt(pending.fiber));
      }
      holding.clear();
    };
  }, []);

  const startSession = useCallback(() => {
    setActiveId(null);
    setOpenedId(null);
    setDraftId(crypto.randomUUID());
  }, []);

  const selectSession = useCallback((session: HistorySession) => {
    setActiveId(session.id);
    setOpenedId(session.id);
  }, []);

  const rememberSession = useCallback((session: HistorySession) => {
    setSessions((current) => [
      session,
      ...current.filter((row) => row.id !== session.id),
    ]);
    setActiveId((current) => current ?? session.id);
  }, []);

  const replaceSession = useCallback((session: HistorySession) => {
    setSessions((current) =>
      current.map((row) => (row.id === session.id ? session : row))
    );
  }, []);

  const drop = useCallback((sessionId: string) => {
    const pending = held.current.get(sessionId);
    if (pending === undefined) {
      return null;
    }

    held.current.delete(sessionId);
    Effect.runFork(Fiber.interrupt(pending.fiber));
    toast.close(pending.toastId);
    return pending;
  }, []);

  const forgetSessionsOf = useCallback(
    (projectId: string) => {
      const open = sessions.some(
        (row) =>
          row.projectId === projectId &&
          (row.id === activeId || row.id === openedId)
      );

      for (const [sessionId, pending] of held.current) {
        if (pending.session.projectId === projectId) {
          drop(sessionId);
        }
      }

      setSessions((current) =>
        current.filter((row) => row.projectId !== projectId)
      );

      if (open) {
        startSession();
      }
    },
    [activeId, drop, openedId, sessions, startSession]
  );

  const undoRemoveSession = useCallback(
    (sessionId: string) => {
      const pending = drop(sessionId);
      if (pending === null) {
        return;
      }

      setSessions((current) => {
        if (current.some((row) => row.id === sessionId)) {
          return current;
        }
        const next = [...current];
        next.splice(Math.min(pending.index, next.length), 0, pending.session);
        return next;
      });

      if (pending.wasActive) {
        setActiveId(sessionId);
        setOpenedId(sessionId);
      }
    },
    [drop]
  );

  const onRemoveSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.value;
      const index = sessions.findIndex((row) => row.id === id);
      const session = sessions[index];
      if (session === undefined) {
        return;
      }

      const wasActive = activeId === id;

      setSessions((current) => current.filter((row) => row.id !== id));
      if (wasActive) {
        startSession();
      }

      const toastId = toast.add({
        actionProps: {
          children: "Undo",
          onClick: () => undoRemoveSession(id),
        },
        description: session.title,
        timeout: Duration.toMillis(undoWindow),
        title: "Session deleted",
      });

      const fiber = Effect.runFork(
        Effect.sleep(undoWindow).pipe(
          Effect.andThen(removeSession(id)),
          Effect.catch((failure) =>
            Effect.sync(() => setSessionsError(failure.message))
          ),
          Effect.asVoid,
          Effect.ensuring(
            Effect.sync(() => {
              if (held.current.get(id)?.toastId === toastId) {
                held.current.delete(id);
                toast.close(toastId);
              }
            })
          )
        )
      );

      held.current.set(id, { fiber, index, session, toastId, wasActive });
    },
    [activeId, sessions, startSession, undoRemoveSession, undoWindow]
  );

  return useMemo(
    () => ({
      activeSession: sessions.find((row) => row.id === activeId) ?? null,
      draftId,
      forgetSessionsOf,
      isLoadingSessions,
      onRemoveSession,
      openedSession: sessions.find((row) => row.id === openedId) ?? null,
      reloadSessions,
      rememberSession,
      replaceSession,
      selectSession,
      sessions,
      sessionsError,
      startSession,
      undoRemoveSession,
    }),
    [
      activeId,
      draftId,
      forgetSessionsOf,
      isLoadingSessions,
      onRemoveSession,
      openedId,
      reloadSessions,
      rememberSession,
      replaceSession,
      selectSession,
      sessions,
      sessionsError,
      startSession,
      undoRemoveSession,
    ]
  );
}
