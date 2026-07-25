"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import { type StudioProjects, useProjects } from "@/hooks/use-projects";
import { type StudioSessions, useSessions } from "@/hooks/use-sessions";
import type { StudioSettings } from "@/lib/studio/settings";
import type { HistorySession } from "@/shared/ipc";

export interface Workspace extends StudioProjects, StudioSessions {
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function useWorkspace(settings: StudioSettings | null): Workspace {
  const projects = useProjects(settings);
  const sessions = useSessions();

  const { selectProject } = projects;
  const { selectSession, startSession } = sessions;
  const rows = sessions.sessions;
  const pickFolder = projects.openFolder;

  const openFolder = useCallback(async () => {
    const project = await pickFolder();
    if (project !== null) {
      startSession();
    }
    return project;
  }, [pickFolder, startSession]);

  const openSession = useCallback(
    (session: HistorySession) => {
      selectProject(session.projectId);
      selectSession(session);
    },
    [selectProject, selectSession]
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
      ...projects,
      ...sessions,
      onSelectSession,
      openFolder,
      selectSession: openSession,
    }),
    [onSelectSession, openFolder, openSession, projects, sessions]
  );
}
