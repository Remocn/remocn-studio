"use client";

import { useMemo } from "react";
import type { PreviewMode } from "@/hooks/use-docs";
import {
  type Command,
  SHORTCUTS,
  type ShortcutId,
} from "@/lib/studio/command-registry";
import type { PaneGroup } from "@/lib/studio/groups";
import type { PaneView } from "@/lib/studio/pane-view";
import { fileManagerName } from "@/lib/studio/platform";
import type { HistorySession, Project } from "@/shared/ipc";

export interface CommandSources {
  readonly canCreateVideo: boolean;
  readonly docsMode: PreviewMode;
  readonly exportUnavailable: string | null;
  readonly groups: readonly PaneGroup[];
  readonly inspectUnavailable: string | null;
  readonly isPreviewShown: boolean;
  readonly isProjectsShown: boolean;
  readonly isTurnRunning: boolean;
  readonly locateProject: () => void;
  readonly openExport: () => void;
  readonly openedSessionId: string | null;
  readonly openedVideoId: string | null;
  readonly openFolder: () => void;
  readonly openNewProject: () => void;
  readonly openNewVideo: () => void;
  readonly openProject: Project | null;
  readonly openProjectSettings: () => void;
  readonly openRemoveProject: () => void;
  readonly openRenameProject: () => void;
  readonly openSettings: () => void;
  readonly openVideo: (videoId: string) => void;
  readonly paneView: PaneView;
  readonly pickDocsMode: (mode: PreviewMode) => void;
  readonly projects: readonly Project[];
  readonly restartSidecar: () => void;
  readonly revealProject: () => void;
  readonly selectProject: (projectId: string) => void;
  readonly selectSession: (session: HistorySession) => void;
  readonly showPane: (view: PaneView) => void;
  readonly snapshotUnavailable: string | null;
  readonly startSessionIn: (videoId: string) => void;
  readonly stopTurn: () => void;
  readonly toggleInspect: () => void;
  readonly togglePreview: () => void;
  readonly toggleProjects: () => void;
  readonly toggleSnapshot: () => void;
}

const NO_PROJECT = "No project is open.";
const PROJECT_GONE = "The project folder is not on disk anymore.";
const NO_VIDEO = "Open a chat to reach its video.";
const VIDEO_GONE = "Nothing in this project renders this video anymore.";
const NO_TURN = "No turn is running.";
const FIRST_VIDEO = "There is no video before this one.";
const LAST_VIDEO = "There is no video after this one.";

const NOOP = () => undefined;

function enabledWhen(reason: string | null): Command["enabled"] {
  return reason === null ? true : { reason };
}

function action(
  id: ShortcutId | string,
  title: string,
  run: () => void,
  extra: Partial<Command> = {}
): Command {
  const shortcut = id in SHORTCUTS ? SHORTCUTS[id as ShortcutId] : undefined;
  return {
    enabled: true,
    group: "actions",
    id,
    run,
    title,
    ...(shortcut === undefined ? {} : { shortcut }),
    ...extra,
  };
}

function revealReasonOf(project: Project | null): string | null {
  if (project === null) {
    return NO_PROJECT;
  }
  return project.missing ? PROJECT_GONE : null;
}

function fileAndProjectCommands(sources: CommandSources): readonly Command[] {
  const projectReason = sources.openProject === null ? NO_PROJECT : null;
  const projectRow = (id: string, title: string, run: () => void) =>
    action(id, title, run, {
      enabled: enabledWhen(projectReason),
      menu: "project",
    });

  const { openedVideoId, startSessionIn } = sources;
  const opened = sources.groups.find(
    (group) => group.video.id === openedVideoId
  );
  let newChatReason: string | null = null;
  if (openedVideoId === null) {
    newChatReason = NO_VIDEO;
  } else if (opened?.video.missing === true) {
    newChatReason = VIDEO_GONE;
  }
  return [
    action(
      "new-chat",
      "New Chat",
      () => {
        if (openedVideoId !== null && newChatReason === null) {
          startSessionIn(openedVideoId);
        }
      },
      {
        enabled: enabledWhen(newChatReason),
        menu: "file",
      }
    ),
    action("new-video", "New Video…", sources.openNewVideo, {
      enabled: enabledWhen(sources.canCreateVideo ? null : NO_PROJECT),
      menu: "file",
    }),
    action("new-project", "New Project…", sources.openNewProject, {
      menu: "file",
    }),
    action("open-folder", "Open Folder…", sources.openFolder, {
      menu: "file",
    }),
    action("settings", "Settings…", sources.openSettings, { menu: "app" }),
    projectRow(
      "project-settings",
      "Project Settings…",
      sources.openProjectSettings
    ),
    projectRow("project-rename", "Rename…", sources.openRenameProject),
    projectRow("project-locate", "Locate Folder…", sources.locateProject),
    action(
      "project-reveal",
      `Reveal in ${fileManagerName()}`,
      sources.revealProject,
      {
        enabled: enabledWhen(revealReasonOf(sources.openProject)),
        menu: "project",
      }
    ),
    {
      ...projectRow(
        "project-remove",
        "Remove from Studio…",
        sources.openRemoveProject
      ),
      separatorBefore: true,
    },
  ];
}

function viewCommands(sources: CommandSources): readonly Command[] {
  const {
    docsMode,
    isPreviewShown,
    isProjectsShown,
    paneView,
    pickDocsMode,
    showPane,
    togglePreview,
    toggleProjects,
  } = sources;
  const paneRow = (id: string, target: PaneView, title: string) =>
    action(
      id,
      title,
      () => {
        showPane(target);
        if (!isProjectsShown) {
          toggleProjects();
        }
      },
      { checked: paneView === target, menu: "view" }
    );

  return [
    action(
      "sidebar",
      isProjectsShown ? "Hide the project list" : "Show the project list",
      toggleProjects,
      { menu: "view" }
    ),
    action(
      "preview",
      isPreviewShown ? "Hide the preview" : "Show the preview",
      togglePreview,
      { menu: "view" }
    ),
    {
      ...paneRow("pane-projects", "projects", "Projects"),
      separatorBefore: true,
    },
    paneRow("pane-assets", "assets", "Assets"),
    paneRow("pane-components", "components", "Components"),
    paneRow("pane-shaders", "shaders", "Shaders"),
    paneRow("pane-captions", "captions", "Captions"),
    action(
      "docs",
      docsMode === "docs" ? "Switch to Preview" : "Switch to Docs",
      () => {
        if (!isPreviewShown) {
          togglePreview();
        }
        pickDocsMode(docsMode === "docs" ? "preview" : "docs");
      },
      {
        enabled: enabledWhen(sources.openedVideoId === null ? NO_VIDEO : null),
        menu: "view",
        separatorBefore: true,
      }
    ),
    action(
      "restart-sidecar",
      "Restart the studio's helper",
      sources.restartSidecar,
      { menu: "view", separatorBefore: true }
    ),
  ];
}

function neighbours(
  groups: readonly PaneGroup[],
  openedVideoId: string | null
): { readonly after: string | null; readonly before: string | null } {
  const ids = groups.map((group) => group.video.id);
  const at = openedVideoId === null ? -1 : ids.indexOf(openedVideoId);
  if (at === -1) {
    return { after: ids[0] ?? null, before: null };
  }
  return { after: ids[at + 1] ?? null, before: ids[at - 1] ?? null };
}

function videoCommands(sources: CommandSources): readonly Command[] {
  const { after, before } = neighbours(sources.groups, sources.openedVideoId);
  const walk = (target: string | null) => () => {
    if (target !== null) {
      sources.openVideo(target);
    }
  };

  return [
    action("export", "Export…", sources.openExport, {
      enabled: enabledWhen(sources.exportUnavailable),
      menu: "video",
    }),
    action("inspect", "Inspect", sources.toggleInspect, {
      enabled: enabledWhen(sources.inspectUnavailable),
      menu: "video",
    }),
    action("snapshot", "Snapshot", sources.toggleSnapshot, {
      enabled: enabledWhen(sources.snapshotUnavailable),
      menu: "video",
    }),
    action("stop-turn", "Stop the turn", sources.stopTurn, {
      enabled: enabledWhen(sources.isTurnRunning ? null : NO_TURN),
      menu: "video",
      separatorBefore: true,
    }),
    action("previous-video", "Previous video", walk(before), {
      enabled: enabledWhen(before === null ? FIRST_VIDEO : null),
      menu: "video",
      separatorBefore: true,
    }),
    action("next-video", "Next video", walk(after), {
      enabled: enabledWhen(after === null ? LAST_VIDEO : null),
      menu: "video",
    }),
  ];
}

function navigationCommands(sources: CommandSources): readonly Command[] {
  const { groups, openedSessionId, openProject, projects } = sources;

  const videos = groups.flatMap((group): readonly Command[] => [
    {
      detail: "Video",
      enabled: true,
      group: "videos",
      id: `video:${group.video.id}`,
      run: () => sources.openVideo(group.video.id),
      title: group.video.name,
    },
    ...group.rows.map((row): Command => {
      const isOpen = row.session.id === openedSessionId;
      return {
        checked: isOpen,
        detail: group.video.name,
        enabled: true,
        group: "videos",
        id: `chat:${row.session.id}`,
        run: isOpen ? NOOP : () => sources.selectSession(row.session),
        title: row.session.title,
      };
    }),
  ]);

  const projectRows = projects.map((project): Command => {
    const isOpen = project.id === openProject?.id;
    return {
      checked: isOpen,
      enabled: true,
      group: "projects",
      id: `project:${project.id}`,
      menu: "file",
      run: isOpen ? NOOP : () => sources.selectProject(project.id),
      title: project.name,
    };
  });

  return [...videos, ...projectRows];
}

export function buildCommands(sources: CommandSources): readonly Command[] {
  return [
    ...fileAndProjectCommands(sources),
    ...viewCommands(sources),
    ...videoCommands(sources),
    ...navigationCommands(sources),
  ];
}

export function useCommands(sources: CommandSources): readonly Command[] {
  const {
    canCreateVideo,
    docsMode,
    exportUnavailable,
    groups,
    inspectUnavailable,
    isPreviewShown,
    isProjectsShown,
    isTurnRunning,
    locateProject,
    openedSessionId,
    openedVideoId,
    openExport,
    openFolder,
    openNewProject,
    openNewVideo,
    openProject,
    openProjectSettings,
    openRemoveProject,
    openRenameProject,
    openSettings,
    openVideo,
    paneView,
    pickDocsMode,
    projects,
    restartSidecar,
    revealProject,
    selectProject,
    selectSession,
    showPane,
    snapshotUnavailable,
    startSessionIn,
    stopTurn,
    toggleInspect,
    togglePreview,
    toggleProjects,
    toggleSnapshot,
  } = sources;

  return useMemo(
    () =>
      buildCommands({
        canCreateVideo,
        docsMode,
        exportUnavailable,
        groups,
        inspectUnavailable,
        isPreviewShown,
        isProjectsShown,
        isTurnRunning,
        locateProject,
        openExport,
        openedSessionId,
        openedVideoId,
        openFolder,
        openNewProject,
        openNewVideo,
        openProject,
        openProjectSettings,
        openRemoveProject,
        openRenameProject,
        openSettings,
        openVideo,
        paneView,
        pickDocsMode,
        projects,
        restartSidecar,
        revealProject,
        selectProject,
        selectSession,
        showPane,
        snapshotUnavailable,
        startSessionIn,
        stopTurn,
        toggleInspect,
        togglePreview,
        toggleProjects,
        toggleSnapshot,
      }),
    [
      canCreateVideo,
      docsMode,
      exportUnavailable,
      groups,
      inspectUnavailable,
      isPreviewShown,
      isProjectsShown,
      isTurnRunning,
      locateProject,
      openedSessionId,
      openedVideoId,
      openExport,
      openFolder,
      openNewProject,
      openNewVideo,
      openProject,
      openProjectSettings,
      openRemoveProject,
      openRenameProject,
      openSettings,
      openVideo,
      paneView,
      pickDocsMode,
      projects,
      restartSidecar,
      revealProject,
      selectProject,
      selectSession,
      showPane,
      snapshotUnavailable,
      startSessionIn,
      stopTurn,
      toggleInspect,
      togglePreview,
      toggleProjects,
      toggleSnapshot,
    ]
  );
}
