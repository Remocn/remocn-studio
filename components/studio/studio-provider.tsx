"use client";

import { createContext, use, useCallback, useMemo } from "react";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type ClaudeModel, useClaudeModel } from "@/hooks/use-claude-model";
import { type Composer, useComposer } from "@/hooks/use-composer";
import { type Environment, useEnvironment } from "@/hooks/use-environment";
import { type FileDrops, useFileDrops } from "@/hooks/use-file-drops";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { type Library, useLibrary } from "@/hooks/use-library";
import { type NewProject, useNewProject } from "@/hooks/use-new-project";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Panes, usePanes } from "@/hooks/use-panes";
import { usePreview } from "@/hooks/use-preview";
import { type Queue, useQueue } from "@/hooks/use-queue";
import { type Tools, useTools } from "@/hooks/use-tools";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";
import type { VideoFormat } from "@/lib/studio/formats";
import type { StudioSettings } from "@/lib/studio/settings";
import type { ProjectDraft, PromptFrame } from "@/shared/ipc";

export type Studio = ClaudeEffort &
  ClaudeModel &
  Panes &
  Workspace & {
    composer: Composer;
    drops: FileDrops;
    environment: Environment;
    library: Library;
    newProject: NewProject;
    queue: Queue;
    settings: StudioSettings | null;
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
  const panes = usePanes(
    settings,
    workspace.projects.length > 0,
    workspace.isLoadingProjects
  );

  const { createProject } = workspace;
  const { showPane } = panes;
  const createAndShow = useCallback(
    async (draft: ProjectDraft, format: VideoFormat) => {
      const project = await createProject(draft, format);
      if (project !== null) {
        showPane("projects");
      }
      return project;
    },
    [createProject, showPane]
  );

  const newProject = useNewProject(createAndShow);
  const library = useLibrary(workspace.hasRunningTurns);

  const previewProjectId = previewTarget(workspace);
  const preview = usePreview(previewProjectId);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    model: model.claudeModel,
    playing: playingFrame(preview.composition, preview.frame),
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

  const queue = useQueue(turn, composer);

  const tools = useTools({
    composer,
    isMissing: opened?.missing ?? false,
    isShown: panes.isPreviewShown,
    isWaiting: turn.permission !== null,
    openedProjectId: opened?.id ?? null,
    preview,
    previewProjectId,
  });

  const environment = useEnvironment(
    opened === null || opened.missing ? null : opened.id,
    previewProjectId === opened?.id ? tools.preview.pick : null
  );

  const drops = useFileDrops({
    drop: composer.drop,
    isComposerOpen:
      opened !== null &&
      !opened.missing &&
      !environment.isBlocking &&
      turn.permission === null,
    paneView: panes.paneView,
    save: library.save,
    showPane,
  });

  const studio = useMemo(
    () => ({
      ...workspace,
      ...model,
      ...effort,
      ...panes,
      composer,
      drops,
      environment,
      library,
      newProject,
      queue,
      settings,
      tools,
      turn,
    }),
    [
      composer,
      drops,
      effort,
      environment,
      library,
      model,
      newProject,
      panes,
      queue,
      settings,
      tools,
      turn,
      workspace,
    ]
  );

  if (!workspace.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={studio}>{children}</StudioContext>;
}

function playingFrame(
  composition: string | null,
  frame: number
): PromptFrame | null {
  return composition === null ? null : { composition, frame };
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
