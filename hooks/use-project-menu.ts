"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useLocateProject } from "@/hooks/use-locate-project";
import { useRevealInFinder } from "@/hooks/use-reveal-in-finder";
import type { Project } from "@/shared/ipc";

export interface ProjectCommands {
  relocateProject: (projectId: string, path: string) => Promise<unknown>;
  removeProject: (projectId: string) => Promise<boolean>;
  renameProject: (projectId: string, name: string) => Promise<unknown>;
}

export interface ProjectMenu {
  canRename: boolean;
  confirmRemove: () => void;
  isRemoving: boolean;
  isRenaming: boolean;
  locate: () => void;
  name: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  openRemove: () => void;
  openRename: () => void;
  reveal: () => void;
  setRemoving: (open: boolean) => void;
  setRenaming: (open: boolean) => void;
  submitRename: () => void;
}

export function useProjectMenu(
  project: Project,
  commands: ProjectCommands
): ProjectMenu {
  const [isRenaming, setRenaming] = useState(false);
  const [isRemoving, setRemoving] = useState(false);
  const [name, setName] = useState(project.name);
  const { reveal } = useRevealInFinder(project.missing ? null : project.path);

  const { relocateProject, removeProject, renameProject } = commands;
  const { id } = project;
  const given = project.name;
  const { locate } = useLocateProject(id, relocateProject);

  const openRename = useCallback(() => {
    setName(given);
    setRenaming(true);
  }, [given]);

  const openRemove = useCallback(() => setRemoving(true), []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const trimmed = name.trim();

  const submitRename = useCallback(async () => {
    if (trimmed.length === 0) {
      return;
    }
    setRenaming(false);
    await renameProject(id, trimmed);
  }, [id, renameProject, trimmed]);

  const confirmRemove = useCallback(async () => {
    setRemoving(false);
    await removeProject(id);
  }, [id, removeProject]);

  return useMemo(
    () => ({
      canRename: trimmed.length > 0,
      confirmRemove,
      isRemoving,
      isRenaming,
      locate,
      name,
      onNameChange,
      openRemove,
      openRename,
      reveal,
      setRemoving,
      setRenaming,
      submitRename,
    }),
    [
      confirmRemove,
      isRemoving,
      isRenaming,
      locate,
      name,
      onNameChange,
      openRemove,
      openRename,
      reveal,
      submitRename,
      trimmed,
    ]
  );
}
