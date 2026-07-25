"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import {
  type ExpandedProjects,
  useExpandedProjects,
} from "@/hooks/use-expanded-projects";
import {
  type ProjectActions,
  useProjectActions,
} from "@/hooks/use-project-actions";
import { type StudioProjects, useProjects } from "@/hooks/use-projects";
import { type StudioSessions, useSessions } from "@/hooks/use-sessions";
import { type Turns, useTurns } from "@/hooks/use-turns";
import { groupSessions, type ProjectGroup } from "@/lib/studio/groups";
import type { StudioSettings } from "@/lib/studio/settings";
import type { HistorySession, ProjectDraft } from "@/shared/ipc";

export interface Workspace
  extends StudioProjects,
    StudioSessions,
    ExpandedProjects,
    ProjectActions,
    Turns {
  groups: readonly ProjectGroup[];
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  startSessionIn: (projectId: string) => void;
}

export function useWorkspace(settings: StudioSettings | null): Workspace {
  const projects = useProjects(settings);
  const sessions = useSessions();
  const actions = useProjectActions();
  const turns = useTurns(sessions.rememberSession);
  const expansion = useExpandedProjects(
    settings,
    projects.activeProject?.id ?? null
  );

  const { forgetProject, rememberProject, replaceProject, selectProject } =
    projects;
  const { forgetSessionsOf, selectSession, startSession } = sessions;
  const { expandProject } = expansion;
  const { stopTurn } = turns;
  const rows = sessions.sessions;
  const pickFolder = projects.openFolder;
  const create = actions.createProject;
  const relocate = actions.relocateProject;
  const remove = actions.removeProject;
  const rename = actions.renameProject;

  const startSessionIn = useCallback(
    (projectId: string) => {
      selectProject(projectId);
      expandProject(projectId);
      startSession();
    },
    [expandProject, selectProject, startSession]
  );

  const openFolder = useCallback(async () => {
    const project = await pickFolder();
    if (project !== null) {
      expandProject(project.id);
      startSession();
    }
    return project;
  }, [expandProject, pickFolder, startSession]);

  const createProject = useCallback(
    async (draft: ProjectDraft) => {
      const project = await create(draft);
      if (project !== null) {
        rememberProject(project);
        expandProject(project.id);
        startSession();
      }
      return project;
    },
    [create, expandProject, rememberProject, startSession]
  );

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      const project = await rename(projectId, name);
      if (project !== null) {
        replaceProject(project);
      }
      return project;
    },
    [rename, replaceProject]
  );

  const relocateProject = useCallback(
    async (projectId: string, path: string) => {
      const project = await relocate(projectId, path);
      if (project !== null) {
        replaceProject(project);
      }
      return project;
    },
    [relocate, replaceProject]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      for (const row of rows) {
        if (row.projectId === projectId) {
          stopTurn(row.id);
        }
      }

      const removed = await remove(projectId);
      if (removed) {
        forgetSessionsOf(projectId);
        forgetProject(projectId);
      }
      return removed;
    },
    [forgetProject, forgetSessionsOf, remove, rows, stopTurn]
  );

  const openSession = useCallback(
    (session: HistorySession) => {
      selectProject(session.projectId);
      expandProject(session.projectId);
      selectSession(session);
    },
    [expandProject, selectProject, selectSession]
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

  const onNewSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      startSessionIn(event.currentTarget.value);
    },
    [startSessionIn]
  );

  const removeSession = sessions.onRemoveSession;

  const onRemoveSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      stopTurn(event.currentTarget.value);
      removeSession(event);
    },
    [removeSession, stopTurn]
  );

  const groups = useMemo(
    () => groupSessions(projects.projects, rows),
    [projects.projects, rows]
  );

  return useMemo(
    () => ({
      ...projects,
      ...sessions,
      ...actions,
      ...expansion,
      ...turns,
      createProject,
      groups,
      onNewSession,
      onRemoveSession,
      onSelectSession,
      openFolder,
      relocateProject,
      removeProject,
      renameProject,
      selectSession: openSession,
      startSessionIn,
    }),
    [
      actions,
      createProject,
      expansion,
      groups,
      onNewSession,
      onRemoveSession,
      onSelectSession,
      openFolder,
      openSession,
      projects,
      relocateProject,
      removeProject,
      renameProject,
      sessions,
      startSessionIn,
      turns,
    ]
  );
}
