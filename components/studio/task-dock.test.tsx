import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskDock } from "@/components/studio/task-dock";
import type { StudioSettings } from "@/lib/studio/settings";
import type { TaskRow } from "@/lib/studio/tasks";
import type { PipelineStage } from "@/shared/pipeline";

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
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} />);

    expect(screen.getByText("Registering the scene")).toBeVisible();
    expect(screen.getByText("1/3")).toBeVisible();
    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("shows the running task's status as its own icon", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} />);

    expect(screen.getAllByLabelText("In progress")).not.toHaveLength(0);
  });

  it("says all done, with its own icon, once every task is completed", () => {
    const done = PLAN.map((task) => ({
      ...task,
      status: "completed" as const,
    }));
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={done} />);

    expect(screen.getByText("All done")).toBeVisible();
    expect(screen.getByLabelText("All done")).toBeVisible();
    expect(screen.getByText("3/3")).toBeVisible();
  });

  it("says Plan when no task is running", () => {
    const pending = PLAN.map((task) => ({
      ...task,
      status: "pending" as const,
    }));
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={pending} />);

    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByLabelText("Pending")).toBeVisible();
    expect(screen.getByText("0/3")).toBeVisible();
  });

  it("opens into the whole list, and closes again", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} />);
    const trigger = screen.getByRole("button", { name: TRIGGER });

    fireEvent.click(trigger);

    expect(screen.getByText("Check the build")).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);

    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("comes back open when it was left open last time", () => {
    render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={[]}
        tasks={PLAN}
      />
    );

    expect(screen.getByText("Check the build")).toBeVisible();
  });

  it("draws nothing at all when the turn wrote no plan", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={[]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

const STAGES: readonly PipelineStage[] = [
  { stage: "analysis", status: "done" },
  { stage: "brand", status: "done" },
  { stage: "script", status: "active" },
  { stage: "motion", status: "pending" },
  { stage: "build", status: "pending" },
  { stage: "review", status: "pending" },
];

describe("TaskDock with a pipeline", () => {
  it("stays on screen with no plan at all while the pipeline is unfinished", () => {
    render(<TaskDock settings={SETTINGS} stages={STAGES} tasks={[]} />);

    expect(screen.getByText("Writing the script")).toBeVisible();
    expect(screen.getByText("2/6")).toBeVisible();
  });

  it("collapses to the running sub-task when the turn has one", () => {
    render(<TaskDock settings={SETTINGS} stages={STAGES} tasks={PLAN} />);

    expect(screen.getByText("Registering the scene")).toBeVisible();
    expect(screen.getByText("2/6")).toBeVisible();
  });

  it("opens into every stage, with the sub-tasks under the active one", () => {
    render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={STAGES}
        tasks={PLAN}
      />
    );

    expect(screen.getByText("Analysis")).toBeVisible();
    expect(screen.getByText("Review")).toBeVisible();
    expect(screen.getByText("Check the build")).toBeVisible();
  });

  it("hands the dock back to the plan once every stage is done", () => {
    const finished = STAGES.map((row) => ({
      ...row,
      status: "done" as const,
    }));
    render(<TaskDock settings={SETTINGS} stages={finished} tasks={[]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
