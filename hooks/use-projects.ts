"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import { causeMessage } from "@/lib/error-message";
import { listProjects, openProject } from "@/lib/studio/projects";
import {
  forgetProjectFolder,
  type StudioSettings,
} from "@/lib/studio/settings";
import type { Project } from "@/shared/ipc";

const PICKER_TITLE = "Open Remotion project";

export interface StudioProjects {
  activeProject: Project | null;
  folderError: string | null;
  forgetProject: (projectId: string) => void;
  isLoadingProjects: boolean;
  isReady: boolean;
  openFolder: () => Promise<Project | null>;
  projects: readonly Project[];
  projectsError: string | null;
  reloadProjects: () => void;
  rememberProject: (project: Project) => void;
  replaceProject: (project: Project) => void;
  selectProject: (projectId: string) => void;
}

export function useProjects(settings: StudioSettings | null): StudioProjects {
  const { error, pick } = useFolderPicker(PICKER_TITLE);
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const rememberProject = useCallback((project: Project) => {
    setProjects((current) => [
      project,
      ...current.filter((row) => row.id !== project.id),
    ]);
    setActiveId(project.id);
  }, []);

  const replaceProject = useCallback((project: Project) => {
    setProjects((current) =>
      current.map((row) => (row.id === project.id ? project : row))
    );
  }, []);

  const forgetProject = useCallback((projectId: string) => {
    setProjects((current) => current.filter((row) => row.id !== projectId));
    setActiveId((current) => (current === projectId ? null : current));
  }, []);

  const reloadProjects = useCallback(() => {
    setIsLoadingProjects(true);

    Effect.runFork(
      listProjects.pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            setProjects(rows);
            setProjectsError(null);
            setActiveId((current) => current ?? rows.at(0)?.id ?? null);
          })
        ),
        Effect.catch((failure) =>
          Effect.sync(() => setProjectsError(failure.message))
        ),
        Effect.ensuring(Effect.sync(() => setIsLoadingProjects(false)))
      )
    );
  }, []);

  const legacyFolder = settings?.legacyProjectFolder ?? null;
  const isReady = settings !== null;

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (legacyFolder === null) {
      reloadProjects();
      return;
    }

    Effect.runFork(
      openProject(legacyFolder).pipe(
        Effect.tap((project) =>
          Effect.sync(() => setActiveId(project.id)).pipe(
            Effect.andThen(forgetProjectFolder)
          )
        ),
        Effect.ignore,
        Effect.andThen(Effect.sync(reloadProjects))
      )
    );
  }, [isReady, legacyFolder, reloadProjects]);

  const openFolder = useCallback(async () => {
    const picked = await pick();
    if (picked === null) {
      return null;
    }

    const exit = await Effect.runPromiseExit(openProject(picked));
    if (Exit.isFailure(exit)) {
      setProjectsError(causeMessage(exit.cause));
      return null;
    }

    rememberProject(exit.value);
    return exit.value;
  }, [pick, rememberProject]);

  return useMemo(
    () => ({
      activeProject: projects.find((row) => row.id === activeId) ?? null,
      folderError: error,
      forgetProject,
      isLoadingProjects,
      isReady,
      openFolder,
      projects,
      projectsError,
      reloadProjects,
      rememberProject,
      replaceProject,
      selectProject: setActiveId,
    }),
    [
      activeId,
      error,
      forgetProject,
      isLoadingProjects,
      isReady,
      openFolder,
      projects,
      projectsError,
      reloadProjects,
      rememberProject,
      replaceProject,
    ]
  );
}
