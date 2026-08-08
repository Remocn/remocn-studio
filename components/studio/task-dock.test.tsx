import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskDock } from "@/components/studio/task-dock";
import type { StudioSettings } from "@/lib/studio/settings";
import type { TaskRow } from "@/lib/studio/tasks";

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
  {
    activeForm: null,
    description: null,
    id: "3",
    status: "pending",
    subject: "Check the build",
  },
];

const TRIGGER = /^Plan, /;

describe("TaskDock", () => {
  it("collapses to the task in hand and how far the plan has got", () => {
    render(<TaskDock settings={SETTINGS} tasks={PLAN} />);

    expect(screen.getByText("Registering the scene")).toBeVisible();
    expect(screen.getByText("1/3")).toBeVisible();
    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("shows the running task's status as its own icon", () => {
    render(<TaskDock settings={SETTINGS} tasks={PLAN} />);

    expect(screen.getAllByLabelText("In progress")).not.toHaveLength(0);
  });

  it("says all done, with its own icon, once every task is completed", () => {
    const done = PLAN.map((task) => ({
      ...task,
      status: "completed" as const,
    }));
    render(<TaskDock settings={SETTINGS} tasks={done} />);

    expect(screen.getByText("All done")).toBeVisible();
    expect(screen.getByLabelText("All done")).toBeVisible();
    expect(screen.getByText("3/3")).toBeVisible();
  });

  it("says Plan when no task is running", () => {
    const pending = PLAN.map((task) => ({
      ...task,
      status: "pending" as const,
    }));
    render(<TaskDock settings={SETTINGS} tasks={pending} />);

    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByLabelText("Pending")).toBeVisible();
    expect(screen.getByText("0/3")).toBeVisible();
  });

  it("opens into the whole list, and closes again", () => {
    render(<TaskDock settings={SETTINGS} tasks={PLAN} />);
    const trigger = screen.getByRole("button", { name: TRIGGER });

    fireEvent.click(trigger);

    expect(screen.getByText("Check the build")).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);

    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("comes back open when it was left open last time", () => {
    render(
      <TaskDock settings={{ ...SETTINGS, taskDock: true }} tasks={PLAN} />
    );

    expect(screen.getByText("Check the build")).toBeVisible();
  });

  it("draws nothing at all when the turn wrote no plan", () => {
    render(<TaskDock settings={SETTINGS} tasks={[]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
