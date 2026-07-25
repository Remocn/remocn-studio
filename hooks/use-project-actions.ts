"use client";

import { useCallback, useMemo } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  createProject,
  relocateProject,
  removeProject,
  renameProject,
} from "@/lib/studio/projects";
import type { Project, ProjectDraft } from "@/shared/ipc";

export interface ProjectActions {
  actionError: string | null;
  createProject: (draft: ProjectDraft) => Promise<Project | null>;
  relocateProject: (projectId: string, path: string) => Promise<Project | null>;
  removeProject: (projectId: string) => Promise<boolean>;
  renameProject: (projectId: string, name: string) => Promise<Project | null>;
}

export function useProjectActions(): ProjectActions {
  const { error, run } = useAsyncAction();

  const create = useCallback(
    (draft: ProjectDraft) => run(createProject(draft)),
    [run]
  );

  const rename = useCallback(
    (projectId: string, name: string) => run(renameProject(projectId, name)),
    [run]
  );

  const relocate = useCallback(
    (projectId: string, path: string) => run(relocateProject(projectId, path)),
    [run]
  );

  const remove = useCallback(
    async (projectId: string) => (await run(removeProject(projectId))) ?? false,
    [run]
  );

  return useMemo(
    () => ({
      actionError: error,
      createProject: create,
      relocateProject: relocate,
      removeProject: remove,
      renameProject: rename,
    }),
    [create, error, relocate, remove, rename]
  );
}
