import { describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import { type CommandSources, useCommands } from "@/hooks/use-commands";
import type { PaneGroup } from "@/lib/studio/groups";
import type { HistorySession, Project, Video } from "@/shared/ipc";

function project(id: string, name: string, missing = false): Project {
  return { createdAt: 1, id, missing, name, path: `/p/${id}`, updatedAt: 1 };
}

function video(id: string, name: string): Video {
  return {
    compositionId: name,
    createdAt: 1,
    deletedAt: null,
    id,
    missing: false,
    name,
    projectId: "p1",
    updatedAt: 1,
  };
}

function session(id: string, videoId: string, title: string): HistorySession {
  return {
    createdAt: 1,
    id,
    mode: "acceptEdits",
    projectId: "p1",
    provider: "claude",
    sdkSessionId: null,
    title,
    updatedAt: 1,
    videoId,
  };
}

function group(row: Video, sessions: readonly HistorySession[]): PaneGroup {
  const rows = sessions.map((entry) => ({
    askedAt: null,
    completed: false,
    error: null,
    progress: null,
    session: entry,
    startedAt: null,
    status: "idle" as const,
    task: null,
    tool: null,
    unread: false,
  }));
  return { hidden: 0, rollup: null, rows, video: row, visible: rows };
}

const INTRO = video("v1", "Intro");
const OUTRO = video("v2", "Outro");
const CHAT_A = session("s1", "v1", "First cut");
const CHAT_B = session("s2", "v2", "Colour pass");

function sources(overrides: Partial<CommandSources> = {}) {
  const spies = {
    openExport: mock(),
    openVideo: mock(),
    selectProject: mock(),
    selectSession: mock(),
    showPane: mock(),
    toggleProjects: mock(),
  };
  const base: CommandSources = {
    canCreateVideo: true,
    docsMode: "preview",
    exportUnavailable: null,
    groups: [group(INTRO, [CHAT_A]), group(OUTRO, [CHAT_B])],
    inspectUnavailable: null,
    isPreviewShown: true,
    isProjectsShown: true,
    isTurnRunning: false,
    locateProject: mock(),
    openedSessionId: "s1",
    openedVideoId: "v1",
    openFolder: mock(),
    openNewProject: mock(),
    openNewVideo: mock(),
    openProject: project("p1", "Launch"),
    openProjectSettings: mock(),
    openRemoveProject: mock(),
    openRenameProject: mock(),
    openSettings: mock(),
    paneView: "videos",
    pickDocsMode: mock(),
    projects: [project("p1", "Launch"), project("p2", "Teaser")],
    restartSidecar: mock(),
    revealProject: mock(),
    snapshotUnavailable: null,
    startSessionIn: mock(),
    stopTurn: mock(),
    toggleInspect: mock(),
    togglePreview: mock(),
    toggleSnapshot: mock(),
    ...spies,
    ...overrides,
  };
  return { ...renderHook(() => useCommands(base)), spies };
}

function byId(commands: ReturnType<typeof sources>["result"], id: string) {
  const found = commands.current.find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`no command ${id}`);
  }
  return found;
}

describe("useCommands", () => {
  it("words Export's refusal with the export hook's own reason", () => {
    const reason =
      "The preview is showing another project, not the one this chat belongs to.";
    const { result } = sources({ exportUnavailable: reason });

    expect(byId(result, "export").enabled).toEqual({ reason });
    expect(byId(result, "inspect").enabled).toBe(true);
  });

  it("lists videos and chats in the sidebar's order, the open chat checked", () => {
    const { result } = sources();
    const videos = result.current.filter((row) => row.group === "videos");

    expect(videos.map((row) => row.id)).toEqual([
      "video:v1",
      "chat:s1",
      "video:v2",
      "chat:s2",
    ]);
    expect(byId(result, "chat:s1").checked).toBe(true);
    expect(byId(result, "chat:s1").detail).toBe("Intro");
    expect(byId(result, "chat:s2").checked).toBe(false);
  });

  it("lists projects in their order with the open one checked", () => {
    const { result, spies } = sources();
    const projects = result.current.filter((row) => row.group === "projects");

    expect(projects.map((row) => row.title)).toEqual(["Launch", "Teaser"]);
    expect(byId(result, "project:p1").checked).toBe(true);

    byId(result, "project:p2").run();
    byId(result, "project:p1").run();
    expect(spies.selectProject.mock.calls).toEqual([["p2"]]);
  });

  it("opens a chat through the sidebar's own setter", () => {
    const { result, spies } = sources();

    byId(result, "chat:s2").run();
    byId(result, "video:v2").run();

    expect(spies.selectSession).toHaveBeenCalledWith(CHAT_B);
    expect(spies.openVideo).toHaveBeenCalledWith("v2");
  });

  it("walks to the next video and refuses at the ends", () => {
    const first = sources();
    expect(byId(first.result, "previous-video").enabled).toEqual({
      reason: "There is no video before this one.",
    });
    byId(first.result, "next-video").run();
    expect(first.spies.openVideo).toHaveBeenCalledWith("v2");

    const last = sources({ openedVideoId: "v2" });
    expect(byId(last.result, "next-video").enabled).toEqual({
      reason: "There is no video after this one.",
    });
  });

  it("shows the sidebar when a view is asked for while it is hidden", () => {
    const { result, spies } = sources({ isProjectsShown: false });

    byId(result, "pane-assets").run();

    expect(spies.showPane).toHaveBeenCalledWith("assets");
    expect(spies.toggleProjects).toHaveBeenCalledTimes(1);
  });

  it("disables what needs a project when none is open", () => {
    const { result } = sources({
      canCreateVideo: false,
      openProject: null,
      projects: [],
    });

    for (const id of [
      "new-video",
      "project-settings",
      "project-rename",
      "project-locate",
      "project-reveal",
      "project-remove",
    ]) {
      expect(byId(result, id).enabled).toEqual({
        reason: "No project is open.",
      });
    }
  });

  it("keeps Locate available for a project whose folder is gone", () => {
    const { result } = sources({ openProject: project("p1", "Launch", true) });

    expect(byId(result, "project-locate").enabled).toBe(true);
    expect(byId(result, "project-reveal").enabled).toEqual({
      reason: "The project folder is not on disk anymore.",
    });
  });

  it("starts a new chat on the open video from the keyboard", () => {
    const startSessionIn = mock();
    const { result } = sources({ startSessionIn });
    const command = byId(result, "new-chat");

    expect(command.shortcut).toEqual({ key: "t", owner: "menu" });
    command.run();
    expect(startSessionIn).toHaveBeenCalledWith("v1");
  });

  it("offers New Chat only while a video is open", () => {
    const { result } = sources({ openedVideoId: null });

    expect(byId(result, "new-chat").enabled).toEqual({
      reason: "Open a chat to reach its video.",
    });
  });

  it("refuses New Chat on a video nothing in the project renders anymore", () => {
    const startSessionIn = mock();
    const gone = { ...INTRO, missing: true };
    const { result } = sources({
      groups: [group(gone, [CHAT_A]), group(OUTRO, [CHAT_B])],
      startSessionIn,
    });
    const command = byId(result, "new-chat");

    expect(command.enabled).toEqual({
      reason: "Nothing in this project renders this video anymore.",
    });
    command.run();
    expect(startSessionIn).not.toHaveBeenCalled();
  });

  it("offers Stop only while a turn runs", () => {
    expect(byId(sources().result, "stop-turn").enabled).toEqual({
      reason: "No turn is running.",
    });
    expect(
      byId(sources({ isTurnRunning: true }).result, "stop-turn").enabled
    ).toBe(true);
  });

  it("opens Projects from the navigation command", () => {
    const { result, spies } = sources({ paneView: "projects" });
    const command = byId(result, "pane-projects");
    expect(command.checked).toBe(true);
    command.run();
    expect(spies.showPane).toHaveBeenCalledWith("projects");
  });

  it("checks the sidebar view that is showing", () => {
    const { result } = sources({ paneView: "components" });

    expect(byId(result, "pane-components").checked).toBe(true);
    expect(byId(result, "pane-assets").checked).toBe(false);
  });
});
