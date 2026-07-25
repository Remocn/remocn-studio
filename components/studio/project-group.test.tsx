import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectGroup } from "@/components/studio/project-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import type { HistorySession, Project } from "@/shared/ipc";

const SHOW_MORE = /Show \d+ more/;
const OTHER_ROW = /Session 0/;

const PROJECT: Project = {
  createdAt: 0,
  id: "project-1",
  missing: false,
  name: "my-video",
  path: "/Users/me/projects/my-video",
  updatedAt: 0,
};

const commands: ProjectCommands = {
  relocateProject: vi.fn(),
  removeProject: vi.fn(),
  renameProject: vi.fn(),
};

function sessions(count: number): HistorySession[] {
  return Array.from({ length: count }, (_unused, index) => ({
    createdAt: 0,
    id: `session-${index}`,
    projectId: PROJECT.id,
    sdkSessionId: null,
    title: `Session ${index}`,
    updatedAt: 0,
  }));
}

function renderGroup(
  shape: {
    isExpanded?: boolean;
    onNewSession?: () => void;
    onToggle?: () => void;
    project?: Project;
    rows?: HistorySession[];
    scaffold?: ScaffoldState;
    turns?: ReadonlyMap<string, TurnState>;
  } = {}
) {
  return render(
    <TooltipProvider>
      <ProjectGroup
        activeSessionId={null}
        commands={commands}
        isExpanded={shape.isExpanded ?? true}
        onNewSession={shape.onNewSession ?? vi.fn()}
        onRemoveSession={vi.fn()}
        onRetryScaffold={vi.fn()}
        onSelectSession={vi.fn()}
        onToggle={shape.onToggle ?? vi.fn()}
        project={shape.project ?? PROJECT}
        scaffold={shape.scaffold}
        sessions={shape.rows ?? sessions(2)}
        turns={shape.turns ?? new Map()}
      />
    </TooltipProvider>
  );
}

describe("ProjectGroup", () => {
  it("says whether it is expanded and reports a toggle with its id", () => {
    const onToggle = vi.fn();
    renderGroup({ onToggle });

    const row = screen.getByRole("button", { name: "my-video" });
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(row).toHaveValue(PROJECT.id);

    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps its sessions out of the tree while collapsed", () => {
    renderGroup({ isExpanded: false });

    expect(screen.getByRole("button", { name: "my-video" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText("Session 0")).not.toBeInTheDocument();
  });

  it("shows the first eight sessions and offers the rest", () => {
    renderGroup({ rows: sessions(11) });

    expect(screen.getByText("Session 7")).toBeVisible();
    expect(screen.queryByText("Session 8")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));

    expect(screen.getByText("Session 10")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: SHOW_MORE })
    ).not.toBeInTheDocument();
  });

  it("marks a session whose turn is running in the background", () => {
    renderGroup({
      turns: new Map([["session-1", { ...IDLE_TURN, isRunning: true }]]),
    });

    expect(
      screen.getByRole("status", { name: "Session 1 is running" })
    ).toBeVisible();
    expect(screen.queryByRole("status", { name: OTHER_ROW })).toBeNull();
  });

  it("says which scaffold step is running", () => {
    renderGroup({
      scaffold: { error: null, isRunning: true, step: "install" },
    });

    expect(screen.getByText("Installing dependencies…")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
  });

  it("offers a retry, and the error, when a scaffold step failed", () => {
    renderGroup({
      scaffold: {
        error: "bun install exited with code 1",
        isRunning: false,
        step: "install",
      },
    });

    expect(
      screen.getByText("Could not install the dependencies.")
    ).toBeVisible();
    expect(screen.getByText("bun install exited with code 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveValue(
      PROJECT.id
    );
  });

  it("says a project has no sessions rather than showing nothing", () => {
    renderGroup({ rows: [] });

    expect(screen.getByText("No sessions yet")).toBeVisible();
  });

  it("refuses a new session in a folder that is gone", () => {
    renderGroup({ project: { ...PROJECT, missing: true } });

    expect(
      screen.getByRole("button", { name: "New session in my-video" })
    ).toBeDisabled();
  });

  it("offers Locate rather than Reveal when the folder is gone", async () => {
    renderGroup({ project: { ...PROJECT, missing: true } });

    fireEvent.click(
      screen.getByRole("button", { name: "Options for my-video" })
    );

    expect(
      await screen.findByRole("menuitem", { name: "Locate…" })
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Reveal in Finder" })
    ).not.toBeInTheDocument();
  });

  it("asks before it removes a project, then removes it by id", async () => {
    renderGroup();

    fireEvent.click(
      screen.getByRole("button", { name: "Options for my-video" })
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remove from studio" })
    );

    expect(await screen.findByText("Remove my-video?")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(commands.removeProject).toHaveBeenCalledWith(PROJECT.id);
  });
});
