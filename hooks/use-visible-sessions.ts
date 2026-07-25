"use client";

import { useCallback, useMemo, useState } from "react";
import type { HistorySession } from "@/shared/ipc";

const LIMIT = 8;

export interface VisibleSessions {
  hidden: number;
  showAll: () => void;
  visible: readonly HistorySession[];
}

export function useVisibleSessions(
  sessions: readonly HistorySession[]
): VisibleSessions {
  const [isFull, setIsFull] = useState(false);

  const showAll = useCallback(() => setIsFull(true), []);

  return useMemo(
    () => ({
      hidden: isFull ? 0 : Math.max(sessions.length - LIMIT, 0),
      showAll,
      visible: isFull ? sessions : sessions.slice(0, LIMIT),
    }),
    [isFull, sessions, showAll]
  );
}
