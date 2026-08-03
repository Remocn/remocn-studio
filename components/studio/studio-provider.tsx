"use client";

import { createContext, use, useMemo } from "react";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type ClaudeModel, useClaudeModel } from "@/hooks/use-claude-model";
import { type Composer, useComposer } from "@/hooks/use-composer";
import { type Environment, useEnvironment } from "@/hooks/use-environment";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { type NewProject, useNewProject } from "@/hooks/use-new-project";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Tools, useTools } from "@/hooks/use-tools";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";

export type Studio = ClaudeEffort &
  ClaudeModel &
  Workspace & {
    composer: Composer;
    environment: Environment;
    newProject: NewProject;
    tools: Tools;
    turn: OpenTurn;
  };

const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const value = use(StudioContext);
  if (value === null) {
    throw new Error("useStudio must be called inside <StudioProvider>.");
  }
  return value;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const settings = useHydratedSettings();
  const workspace = useWorkspace(settings);
  const model = useClaudeModel(settings);
  const effort = useClaudeEffort(settings);
  const newProject = useNewProject(workspace.createProject);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    model: model.claudeModel,
    projectId: workspace.activeProject?.id ?? null,
    session: workspace.openedSession,
    turns: workspace,
  });

  const opened = workspace.openedProject;

  const composer = useComposer({
    onEscape: turn.isRunning ? turn.stop : undefined,
    onSubmit: turn.send,
    projectId: opened?.id ?? null,
  });

  const previewProjectId = previewTarget(workspace);

  const tools = useTools({
    composer,
    isMissing: opened?.missing ?? false,
    isWaiting: turn.permission !== null,
    openedProjectId: opened?.id ?? null,
    previewProjectId,
  });

  const environment = useEnvironment(
    opened === null || opened.missing ? null : opened.id,
    previewProjectId === opened?.id ? tools.preview.pick : null
  );

  const studio = useMemo(
    () => ({
      ...workspace,
      ...model,
      ...effort,
      composer,
      environment,
      newProject,
      tools,
      turn,
    }),
    [composer, effort, environment, model, newProject, tools, turn, workspace]
  );

  if (!workspace.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={studio}>{children}</StudioContext>;
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
