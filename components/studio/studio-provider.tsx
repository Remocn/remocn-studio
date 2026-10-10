"use client";

import {
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAppMenu } from "@/hooks/use-app-menu";
import { type AssetsScope, useAssetsScope } from "@/hooks/use-assets-scope";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useCommands } from "@/hooks/use-commands";
import {
  type Composer,
  type ComposerActions,
  useComposer,
} from "@/hooks/use-composer";
import { useCrashReporting } from "@/hooks/use-crash-reporting";
import { type Docs, useDocs } from "@/hooks/use-docs";
import { type Environment, useEnvironment } from "@/hooks/use-environment";
import { type Feedback, useFeedback } from "@/hooks/use-feedback";
import { type FileDrops, useFileDrops } from "@/hooks/use-file-drops";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { type Library, useLibrary } from "@/hooks/use-library";
import { type StudioModels, useModels } from "@/hooks/use-models";
import { useNavigationMotion } from "@/hooks/use-navigation-motion";
import { type NewProject, useNewProject } from "@/hooks/use-new-project";
import { type NewVideo, useNewVideo } from "@/hooks/use-new-video";
import {
  type NotificationConsent,
  useNotificationConsent,
} from "@/hooks/use-notification-consent";
import { type Onboarding, useOnboarding } from "@/hooks/use-onboarding";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Panes, usePanes } from "@/hooks/use-panes";
import { type Preferences, usePreferences } from "@/hooks/use-preferences";
import { usePlayingFrame, usePreview } from "@/hooks/use-preview";
import { useProjectMenu } from "@/hooks/use-project-menu";
import {
  type Accounts,
  useProviderAccounts,
} from "@/hooks/use-provider-accounts";
import { type Queue, useQueue } from "@/hooks/use-queue";
import { useReconciledVideos } from "@/hooks/use-reconciled-videos";
import { isSettingUp } from "@/hooks/use-scaffold";
import { type SettingsView, useSettingsView } from "@/hooks/use-settings-view";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useSidecar } from "@/hooks/use-sidecar";
import { useSidecarStatus } from "@/hooks/use-sidecar-status";
import { useStudioAttention } from "@/hooks/use-studio-attention";
import { useTemplateLinks } from "@/hooks/use-template-links";
import { type Tools, useTools } from "@/hooks/use-tools";
import { type Updates, useUpdates } from "@/hooks/use-updates";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";
import type { VideoFormat } from "@/lib/studio/formats";
import { rowOf, type SessionRow } from "@/lib/studio/groups";
import { type ShellMood, shellMood } from "@/lib/studio/mood";
import type { PaneView } from "@/lib/studio/pane-view";
import type { StudioSettings } from "@/lib/studio/settings";
import { isStudioBootReady } from "@/lib/studio/splash";
import type { TurnState } from "@/lib/studio/turns";
import type { ProjectDraft } from "@/shared/ipc";
import { type AgentProvider, PROVIDER_INFO } from "@/shared/providers";
import { CommandPalette } from "./command-palette";
import { ProjectDialogs } from "./project-dialogs";

export type Studio = ClaudeEffort &
  StudioModels &
  Panes &
  Workspace & {
    accounts: Accounts;
    composerActions: ComposerActions;
    docs: Docs;
    drops: FileDrops;
    environment: Environment;
    feedback: Feedback;
    library: Library;
    mood: ShellMood;
    newProject: NewProject;
    newVideo: NewVideo;
    openSearch: () => void;
    isLibraryOpen: boolean;
    libraryAnimate: boolean;
    assetsScope: AssetsScope;
    componentScope: "all" | "saved" | "bundled";
    setComponentScope: (scope: "all" | "saved" | "bundled") => void;
    openLibrary: (view: PaneView) => void;
    closeLibrary: () => void;
    projectSessions: readonly SessionRow[];
    notifications: NotificationConsent;
    preferences: Preferences;
    provider: AgentProvider;
    settings: StudioSettings | null;
    settingsView: SettingsView;
    tools: Tools;
    onboarding: Onboarding;
    updates: Updates;
  };

const StudioContext = createContext<Studio | null>(null);
const TurnContext = createContext<OpenTurn | null>(null);
const ComposerContext = createContext<Composer | null>(null);
const QueueContext = createContext<Queue | null>(null);
const BootContext = createContext(false);

function provided<T>(value: T | null, hook: string): T {
  if (value === null) {
    throw new Error(`${hook} must be called inside <StudioProvider>.`);
  }
  return value;
}

export function useStudio(): Studio {
  return provided(use(StudioContext), "useStudio");
}

export function useStudioTurn(): OpenTurn {
  return provided(use(TurnContext), "useStudioTurn");
}

export function useStudioComposer(): Composer {
  return provided(use(ComposerContext), "useStudioComposer");
}

export function useStudioQueue(): Queue {
  return provided(use(QueueContext), "useStudioQueue");
}

export function useStudioBoot(): boolean {
  return use(BootContext);
}

export function StudioProvider({
  children,
  splash = null,
}: {
  children: React.ReactNode;
  splash?: React.ReactNode;
}) {
  const settings = useHydratedSettings();
  const { turns, workspace } = useWorkspace(settings);

  return (
    <>
      <StudioStateProvider
        settings={settings}
        turns={turns}
        workspace={workspace}
      >
        {children}
      </StudioStateProvider>
      <BootContext value={isStudioBootReady(workspace)}>{splash}</BootContext>
    </>
  );
}

const StillProjectDialogs = memo(ProjectDialogs);

const StillCommandPalette = memo(CommandPalette);

function StudioStateProvider({
  children,
  settings,
  turns,
  workspace,
}: {
  children: React.ReactNode;
  settings: StudioSettings | null;
  turns: ReadonlyMap<string, TurnState>;
  workspace: Workspace;
}) {
  const model = useModels(settings);
  const accounts = useProviderAccounts();
  const effort = useClaudeEffort(settings);
  const preferences = usePreferences(settings);
  const notifications = useNotificationConsent(settings);
  const settingsView = useSettingsView(workspace.activeProject?.id ?? null);
  const updates = useUpdates();

  // The build reading is the updater's, and it is deliberately shared: the two
  // features ask the same question — is this a released build, and which one —
  // and a second `studio_build` invoke would let them answer it differently.
  useCrashReporting({
    consent: preferences.crashReports,
    environment: updates.environment,
    isHydrated: settings !== null,
    version: updates.version,
  });

  const panes = usePanes(
    settings,
    workspace.projects.length > 0,
    workspace.isLoadingProjects
  );

  const { createProject } = workspace;
  const { showPane } = panes;
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  const [libraryAnimate, setLibraryAnimate] = useState(false);
  const assetsScope = useAssetsScope();
  const [componentScope, setComponentScope] = useState<
    "all" | "saved" | "bundled"
  >("all");
  const shouldAnimateNavigation = useNavigationMotion();
  const openLibrary = useCallback(
    (view: PaneView) => {
      setLibraryAnimate(shouldAnimateNavigation());
      showPane(view);
      setLibraryOpen(view !== "videos");
    },
    [showPane, shouldAnimateNavigation]
  );
  const closeLibrary = useCallback(() => {
    setLibraryAnimate(shouldAnimateNavigation());
    setLibraryOpen(false);
  }, [shouldAnimateNavigation]);
  const projectSessions = useMemo(
    () =>
      workspace.sessions
        .filter((session) => session.projectId === workspace.activeProject?.id)
        .toSorted((a, b) => b.updatedAt - a.updatedAt)
        .map((session) => rowOf(session, turns.get(session.id))),
    [workspace.sessions, workspace.activeProject?.id, turns]
  );
  const createAndShow = useCallback(
    async (draft: ProjectDraft, format: VideoFormat) => {
      const project = await createProject(draft, format);
      if (project !== null) {
        showPane("videos");
      }
      return project;
    },
    [createProject, showPane]
  );

  const newProject = useNewProject(createAndShow);

  const { openTemplate } = workspace;
  const showVideos = useCallback(() => {
    showPane("videos");
    closeLibrary();
  }, [showPane, closeLibrary]);
  useTemplateLinks({ onOpened: showVideos, openTemplate });

  const { addVideo } = workspace;
  const addAndShow = useCallback(
    async (name: string, format: VideoFormat) => {
      const video = await addVideo(name, format);
      if (video !== null) {
        showPane("videos");
      }
      return video;
    },
    [addVideo, showPane]
  );

  const newVideo = useNewVideo(addAndShow);
  useEffect(() => {
    if (newVideo.isOpen || newProject.isOpen) {
      closeLibrary();
    }
  }, [newVideo.isOpen, newProject.isOpen, closeLibrary]);

  const {
    activeProject,
    openFolder,
    projects,
    relocateProject,
    removeProject,
    renameProject,
    selectProject,
  } = workspace;

  const projectCommands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );
  const projectMenu = useProjectMenu(activeProject, projectCommands);

  const openProjectSettings = useCallback(() => {
    if (activeProject !== null) {
      settingsView.openProject(activeProject.id);
    }
  }, [activeProject, settingsView.openProject]);

  const library = useLibrary(workspace.hasRunningTurns);

  // The preview follows the sidecar: its request is long-lived, so a crash
  // fails it and nothing else would bring it back. Only the phase is taken, and
  // it stays out of the context value — putting the whole `Sidecar` in there
  // changed the value's identity on every status event and re-rendered every
  // consumer of the studio for a reading only this one hook wants.
  const sidecarPhase = useSidecarStatus()?.phase ?? "unknown";

  const previewProjectId = previewTarget(workspace);
  const preview = usePreview(
    previewProjectId,
    workspace.openedVideo?.compositionId ?? null,
    sidecarPhase,
    workspace.projects.find((project) => project.id === previewProjectId)?.path
  );

  useReconciledVideos(preview, previewProjectId, workspace.reconcile);

  const playing = usePlayingFrame(preview);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    models: model.models,
    playing,
    projectId: workspace.activeProject?.id ?? null,
    session: workspace.openedSession,
    startSession: workspace.startSession,
    states: turns,
    turns: workspace,
    videoId: workspace.openedVideo?.id ?? null,
  });

  const opened = workspace.openedProject;
  const openedId = opened?.id ?? null;
  const openedMissing = opened?.missing ?? false;
  const openedVideoId = workspace.openedVideo?.id ?? null;
  const openedSessionId = workspace.openedSession?.id ?? null;

  const composer = useComposer({
    onEscape: turn.isRunning ? turn.stop : undefined,
    onSubmit: turn.send,
    projectId: openedId,
  });

  const queue = useQueue(turn, composer);

  // The documents are the open chat's video's, which is what makes the pane's
  // two modes agree with everything else about which video is on screen.
  const docs = useDocs({
    entries: turn.entries,
    isTurnRunning: workspace.hasRunningTurns,
    projectId: openedId,
    videoId: openedVideoId,
  });

  const tools = useTools({
    composer,
    isDocs: docs.mode === "docs",
    isMissing: openedMissing,
    isShown: panes.isPreviewShown,
    isTurnRunning: turn.isRunning,
    isWaiting: turn.permission !== null || turn.source !== null,
    openedProjectId: openedId,
    prepareShader: turn.prepareShader,
    preview,
    previewProjectId,
    projectPath: workspace.projects.find(
      (project) => project.id === previewProjectId
    )?.path,
    // The pane reads the code of the project the *chat* is in, which is the
    // same one the preview is showing whenever the tools are available at all.
    writeProjectId: openedId,
  });

  const sidecar = useSidecar();

  const baseCommands = useCommands({
    canCreateVideo: activeProject !== null && !activeProject.missing,
    docsMode: docs.mode,
    exportUnavailable: tools.exporting.unavailable,
    groups: workspace.groups,
    inspectUnavailable: tools.inspect.unavailable,
    isPreviewShown: panes.isPreviewShown,
    isProjectsShown: panes.isProjectsShown || panes.isProjectsPeeking,
    isTurnRunning: turn.isRunning,
    locateProject: projectMenu.locate,
    openExport: tools.exporting.open,
    openedSessionId,
    openedVideoId,
    openFolder,
    openNewProject: newProject.open,
    openNewVideo: newVideo.open,
    openProject: activeProject,
    openProjectSettings,
    openRemoveProject: projectMenu.openRemove,
    openRenameProject: projectMenu.openRename,
    openSettings: settingsView.open,
    openVideo: workspace.openVideo,
    paneView: panes.paneView,
    pickDocsMode: docs.pickMode,
    projects,
    restartSidecar: sidecar.restart,
    revealProject: projectMenu.reveal,
    selectProject,
    selectSession: workspace.selectSession,
    showPane: openLibrary,
    snapshotUnavailable: tools.snapshot.unavailable,
    startSessionIn: workspace.startSessionIn,
    stopTurn: turn.stop,
    toggleInspect: tools.inspect.toggle,
    togglePreview: panes.togglePreview,
    toggleProjects: panes.toggleProjects,
    toggleSnapshot: tools.snapshot.toggle,
  });
  const navigationCommands = useMemo(
    () =>
      baseCommands.map((command) => {
        if (
          command.group !== "videos" &&
          command.group !== "projects" &&
          command.id !== "new-chat" &&
          command.id !== "previous-video" &&
          command.id !== "next-video"
        ) {
          return command;
        }
        return {
          ...command,
          run: () => {
            closeLibrary();
            command.run();
          },
        };
      }),
    [baseCommands, closeLibrary]
  );
  const palette = useCommandPalette(navigationCommands, openedSessionId);
  const isMenuInstalled = useAppMenu(palette.commands);
  useShortcuts(palette.commands, isMenuInstalled);

  useStudioAttention({
    exportState: tools.exporting.state,
    isEnabled: notifications.isOn,
    isEventEnabled: notifications.isEventEnabled,
    sessions: workspace.sessions,
    sidecarPhase,
    turns,
    videos: workspace.videos,
  });

  // Checked mid-scaffold, the checklist reported the dependencies missing,
  // offered a second install beside the running one, and was never asked
  // again once the first one landed.
  const environment = useEnvironment(
    openedMissing || isSettingUp(workspace.scaffolds, openedId)
      ? null
      : openedId,
    previewProjectId === opened?.id ? tools.preview.pick : null,
    turn.provider
  );

  const feedback = useFeedback({
    environment: updates.environment,
    os: updates.os,
    provider: PROVIDER_INFO[turn.provider].name,
    version: updates.version,
  });

  const drops = useFileDrops({
    drop: composer.drop,
    enabled: !settingsView.isOpen,
    isComposerOpen:
      openedId !== null &&
      !openedMissing &&
      !environment.isBlocking &&
      turn.permission === null &&
      turn.source === null,
    paneView: panes.paneView,
    save: library.save,
    showPane: openLibrary,
  });

  const onboarding = useOnboarding({
    blocked:
      turn.permission !== null ||
      turn.source !== null ||
      environment.isBlocking ||
      environment.isChecking ||
      environment.isInstalling ||
      environment.isInstallingNode ||
      environment.isUpgrading ||
      environment.error !== null ||
      newProject.isOpen ||
      newVideo.isOpen,
    hasProject:
      openedId !== null &&
      !openedMissing &&
      previewTarget(workspace) !== null &&
      environment.checks.length > 0,
    isRunning: workspace.hasRunningTurns,
    isSettingsOpen: settingsView.isOpen,
    settings,
  });

  const { caret, fill, pick, write } = composer;
  const composerActions = useMemo(
    () => ({ caret, fill, pick, write }),
    [caret, fill, pick, write]
  );

  const { isBusy, tone } = shellMood(turns);
  const mood = useMemo(() => ({ isBusy, tone }), [isBusy, tone]);
  const { provider } = turn;

  const studio = useMemo(
    () => ({
      ...workspace,
      ...model,
      ...effort,
      ...panes,
      accounts,
      assetsScope,
      closeLibrary,
      componentScope,
      composerActions,
      docs,
      drops,
      environment,
      feedback,
      isLibraryOpen,
      library,
      libraryAnimate,
      mood,
      newProject,
      newVideo,
      notifications,
      onboarding,
      openLibrary,
      openSearch: palette.toggle,
      preferences,
      projectSessions,
      provider,
      setComponentScope,
      settings,
      settingsView,
      tools,
      updates,
    }),
    [
      accounts,
      composerActions,
      docs,
      drops,
      effort,
      environment,
      feedback,
      library,
      model,
      mood,
      newProject,
      newVideo,
      notifications,
      palette.toggle,
      isLibraryOpen,
      libraryAnimate,
      assetsScope,
      componentScope,
      openLibrary,
      closeLibrary,
      projectSessions,
      panes,
      preferences,
      provider,
      settings,
      settingsView,
      tools,
      onboarding,
      updates,
      workspace,
    ]
  );

  if (!workspace.isReady) {
    return null;
  }

  return (
    <StudioContext value={studio}>
      <ComposerContext value={composer}>
        <TurnContext value={turn}>
          <QueueContext value={queue}>
            {children}
            <StillProjectDialogs menu={projectMenu} project={activeProject} />
            <StillCommandPalette palette={palette} />
          </QueueContext>
        </TurnContext>
      </ComposerContext>
    </StudioContext>
  );
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
