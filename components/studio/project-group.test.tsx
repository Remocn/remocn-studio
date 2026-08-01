import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectGroup } from "@/components/studio/project-group";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { paneGroups, SESSION_LIMIT } from "@/lib/studio/groups";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import type { HistorySession, Project } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const MINUTE = 60_000;
const SHOW_MORE = /Show \d+ more/;
const OTHER_ROW = /Session 0/;
const PROJECT_ROW = /^my-video/;

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

const waiting = (askedAt: number): TurnState => ({
  ...IDLE_TURN,
  isRunning: true,
  permissions: [
    { askedAt, id: "ask-1", input: {}, name: "Bash", reason: "bash" },
  ],
  startedAt: askedAt,
});

function sessions(count: number): HistorySession[] {
  return Array.from({ length: count }, (_unused, index) => ({
    createdAt: 0,
    id: `session-${index}`,
    mode: "auto",
    projectId: PROJECT.id,
    sdkSessionId: null,
    title: `Session ${index}`,
    updatedAt: 0,
  }));
}

function renderGroup(
  shape: {
    isExpanded?: boolean;
    limit?: number;
    onNewSession?: () => void;
    onToggle?: () => void;
    project?: Project;
    rows?: HistorySession[];
    scaffold?: ScaffoldState;
    turns?: ReadonlyMap<string, TurnState>;
  } = {}
) {
  const project = shape.project ?? PROJECT;
  const [group] = paneGroups(
    [project],
    shape.rows ?? sessions(2),
    shape.turns ?? new Map(),
    shape.limit ?? SESSION_LIMIT
  );

  // The row is built out of sidebar menu parts, which read `SidebarProvider`'s
  // context and expect to sit in a `SidebarMenu` list.
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <SidebarMenu>
          <ProjectGroup
            activeSessionId={null}
            commands={commands}
            group={group}
            isExpanded={shape.isExpanded ?? true}
            now={NOW}
            onNewSession={shape.onNewSession ?? vi.fn()}
            onRemoveSession={vi.fn()}
            onRetryScaffold={vi.fn()}
            onSelectSession={vi.fn()}
            onToggle={shape.onToggle ?? vi.fn()}
            scaffold={shape.scaffold}
          />
        </SidebarMenu>
      </SidebarProvider>
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

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));

    expect(screen.queryByText("Session 10")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 3 more" })).toBeVisible();
  });

  it("counts only the quiet rows it hides, and never hides a busy one", () => {
    renderGroup({
      limit: 2,
      rows: sessions(5),
      turns: new Map([["session-4", waiting(NOW - MINUTE)]]),
    });

    expect(screen.getByText("Session 4")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show 2 more" })).toBeVisible();
  });

  it("offers nothing to show when every row is already on screen", () => {
    renderGroup({ rows: sessions(3) });

    expect(
      screen.queryByRole("button", { name: SHOW_MORE })
    ).not.toBeInTheDocument();
  });

  it("says a collapsed group is waiting on you, and for how many sessions", () => {
    renderGroup({
      isExpanded: false,
      rows: sessions(3),
      turns: new Map([
        ["session-0", waiting(NOW - MINUTE)],
        ["session-2", waiting(NOW - 3 * MINUTE)],
      ]),
    });

    expect(
      screen.getByRole("img", { name: "2 sessions waiting" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: PROJECT_ROW })).toHaveTextContent(
      "2"
    );
  });

  it("keeps a settled group's row free of any rollup", () => {
    renderGroup({ isExpanded: false, rows: sessions(3) });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("marks a session whose turn is running in the background", () => {
    renderGroup({
      turns: new Map([["session-1", { ...IDLE_TURN, isRunning: true }]]),
    });

    expect(
      screen.getByRole("img", { name: "Session 1 is running" })
    ).toBeVisible();
    expect(screen.queryByRole("img", { name: OTHER_ROW })).toBeNull();
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
