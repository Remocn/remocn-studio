"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import {
  type ProjectFolder,
  useProjectFolder,
} from "@/hooks/use-project-folder";
import { type StudioSessions, useSessions } from "@/hooks/use-sessions";
import type { StudioSettings } from "@/lib/studio/settings";
import type { HistorySession } from "@/shared/ipc";

export interface Workspace extends ProjectFolder, StudioSessions {
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  openFolder: () => Promise<void>;
}

export function useWorkspace(settings: StudioSettings | null): Workspace {
  const folder = useProjectFolder(settings);
  const sessions = useSessions();

  const { pickFolder, setProjectFolder } = folder;
  const { selectSession, startSession } = sessions;
  const rows = sessions.sessions;

  const openFolder = useCallback(async () => {
    const picked = await pickFolder();
    if (picked !== null) {
      startSession();
    }
  }, [pickFolder, startSession]);

  const openSession = useCallback(
    (session: HistorySession) => {
      setProjectFolder(session.folder);
      selectSession(session);
    },
    [selectSession, setProjectFolder]
  );

  const onSelectSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const found = rows.find((row) => row.id === event.currentTarget.value);
      if (found !== undefined) {
        openSession(found);
      }
    },
    [openSession, rows]
  );

  return useMemo(
    () => ({
      ...folder,
      ...sessions,
      onSelectSession,
      openFolder,
      selectSession: openSession,
    }),
    [folder, onSelectSession, openFolder, openSession, sessions]
  );
}
