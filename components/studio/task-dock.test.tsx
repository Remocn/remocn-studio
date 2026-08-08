import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDock } from "@/components/studio/task-dock";
import { COLUMN, DOCK_GAP, ICON_SLOT, PANEL_MAX } from "@/lib/studio/dock";
import type { StudioSettings } from "@/lib/studio/settings";
import type { TaskRow } from "@/lib/studio/tasks";

const HEADING = /Plan/;

const SETTINGS: StudioSettings = {
  claudeEffort: null,
  claudeModel: null,
  expandedProjects: [],
  legacyProjectFolder: null,
  previewPane: null,
  projectsPane: null,
  taskDock: null,
};

const PLAN: readonly TaskRow[] = [
  {
    activeForm: "Building the scene",
    description: "Write the component",
    id: "1",
    status: "completed",
    subject: "Scene component",
  },
  {
    activeForm: "Registering the scene",
    description: null,
    id: "2",
    status: "in_progress",
    subject: "Register in Series",
  },
];

// jsdom has no layout: every element measures 0, and `useElementSize` would
// therefore always report a pane with no gutter. Widths are faked at the two
// places it reads them, so the rules are exercised at real sizes.
function paneWidth(width: number) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );

  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskDock", () => {
  it("shows the plan beside the transcript when the gutter fits it", () => {
    paneWidth(COLUMN + 2 * (PANEL_MAX + DOCK_GAP));
    render(<TaskDock settings={null} tasks={PLAN} />);

    expect(screen.getByRole("region", { name: "Plan" })).toBeVisible();
    expect(screen.getByText("Register in Series")).toBeVisible();
    expect(screen.getByRole("heading", { name: HEADING })).toBeVisible();
    expect(screen.getByText("1/2")).toBeVisible();
  });

  it("collapses to a button that says how far the plan has got", () => {
    paneWidth(COLUMN + 2 * (ICON_SLOT + DOCK_GAP));
    render(<TaskDock settings={null} tasks={PLAN} />);

    expect(
      screen.queryByRole("region", { name: "Plan" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show the plan, 1/2" })
    ).toBeVisible();
  });

  it("hides by hand into the button that brings it back", () => {
    paneWidth(COLUMN + 2 * (PANEL_MAX + DOCK_GAP));
    render(<TaskDock settings={null} tasks={PLAN} />);

    fireEvent.click(screen.getByRole("button", { name: "Hide the plan" }));

    expect(
      screen.queryByRole("region", { name: "Plan" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show the plan, 1/2" })
    ).toBeVisible();
  });

  it("keeps a plan hidden by hand hidden, and the choice is remembered", () => {
    paneWidth(COLUMN + 2 * (PANEL_MAX + DOCK_GAP));
    render(
      <TaskDock settings={{ ...SETTINGS, taskDock: false }} tasks={PLAN} />
    );

    expect(
      screen.queryByRole("region", { name: "Plan" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show the plan, 1/2" })
    ).toBeVisible();
  });

  it("hides the button too once there is no room for it", () => {
    paneWidth(COLUMN);
    render(<TaskDock settings={null} tasks={PLAN} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Plan" })
    ).not.toBeInTheDocument();
  });

  it("draws nothing at all when the turn wrote no plan", () => {
    paneWidth(COLUMN + 2 * (PANEL_MAX + DOCK_GAP));
    render(<TaskDock settings={null} tasks={[]} />);

    expect(
      screen.queryByRole("region", { name: "Plan" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
