import { describe, expect, it } from "vitest";
import { groupActivity } from "@/lib/studio/runs";
import {
  activeForm,
  planTasks,
  type TaskRow,
  taskGlyph,
} from "@/lib/studio/tasks";
import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";

const CWD = "/Users/me/projects/my-video";

function create(
  id: string,
  taskId: string | null,
  subject: string,
  extra: Record<string, unknown> = {}
): ActivityEntry {
  return {
    id,
    input: { description: `${subject} in detail`, subject, ...extra },
    kind: "activity",
    name: "TaskCreate",
    result:
      taskId === null
        ? null
        : `Task #${taskId} created successfully: ${subject}`,
    state: taskId === null ? "running" : "done",
  };
}

function update(id: string, input: Record<string, unknown>): ActivityEntry {
  return {
    id,
    input,
    kind: "activity",
    name: "TaskUpdate",
    result: "Updated task status",
    state: "done",
  };
}

function read(id: string, file: string): ActivityEntry {
  return {
    id,
    input: { file_path: `${CWD}/${file}` },
    kind: "activity",
    name: "Read",
    result: "…",
    state: "done",
  };
}

function tasksOf(
  entries: readonly TranscriptEntry[]
): readonly (readonly TaskRow[])[] {
  return groupActivity(entries).flatMap((item) =>
    item.kind === "tasks" ? [item.tasks] : []
  );
}

describe("planTasks", () => {
  it("folds creates and updates into one checklist at the first create", () => {
    const items = groupActivity([
      create("c1", "1", "Backend"),
      create("c2", "2", "Frontend"),
      update("u1", { status: "in_progress", taskId: "1" }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "c1",
      kind: "tasks",
      tasks: [
        {
          activeForm: null,
          description: "Backend in detail",
          id: "1",
          status: "in_progress",
          subject: "Backend",
        },
        {
          activeForm: null,
          description: "Frontend in detail",
          id: "2",
          status: "pending",
          subject: "Frontend",
        },
      ],
    });
  });

  it("lands an update that arrives many entries later on its task", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend"),
      read("r1", "src/A.tsx"),
      read("r2", "src/B.tsx"),
      read("r3", "src/C.tsx"),
      update("u1", { status: "completed", taskId: "1" }),
    ]);

    expect(tasks[0].status).toBe("completed");
  });

  it("removes a deleted task from the list", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend"),
      create("c2", "2", "Frontend"),
      update("u1", { status: "deleted", taskId: "1" }),
    ]);

    expect(tasks.map((task) => task.id)).toEqual(["2"]);
  });

  it("takes a renamed subject and a new activeForm", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend", { activeForm: "Building backend" }),
      update("u1", { activeForm: "Wiring the API", subject: "API" }),
      update("u2", {
        activeForm: "Wiring the API",
        subject: "API",
        taskId: "1",
      }),
    ]);

    expect(tasks[0].subject).toBe("API");
    expect(tasks[0].activeForm).toBe("Wiring the API");
  });

  it("ignores an update for an id nothing was created with", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend"),
      update("u1", { status: "completed", taskId: "9" }),
    ]);

    expect(tasks).toEqual([
      {
        activeForm: null,
        description: "Backend in detail",
        id: "1",
        status: "pending",
        subject: "Backend",
      },
    ]);
  });

  it("matches a create whose result has not arrived by its creation order", () => {
    const [tasks] = tasksOf([
      create("c1", null, "Backend"),
      update("u1", { status: "in_progress", taskId: "1" }),
    ]);

    expect(tasks[0].status).toBe("in_progress");
  });

  it("leaves a failed create an activity row of its own", () => {
    const failed: ActivityEntry = {
      ...create("bad", null, "Backend"),
      result: "TaskCreate failed",
      state: "failed",
    };

    const items = groupActivity([create("c1", "1", "Backend"), failed]);

    expect(items.map((item) => item.kind)).toEqual(["tasks", "entry"]);
  });

  it("lands an update from a later turn on the plan that owns the task", () => {
    const entries: TranscriptEntry[] = [
      create("c1", "6", "Write SCRIPT.md"),
      create("c2", "7", "Build the scenes"),
      {
        attachments: [],
        elements: [],
        id: "user-1",
        kind: "user",
        text: "but do not start yet",
      },
      update("u1", { status: "in_progress", taskId: "6" }),
      update("u2", { status: "completed", taskId: "7" }),
    ];

    const items = groupActivity(entries);

    // The updates draw no rows of their own — they moved the checklist above.
    expect(items.map((item) => item.kind)).toEqual(["tasks", "entry"]);

    const [tasks] = tasksOf(entries);
    expect(tasks.map((task) => task.status)).toEqual([
      "in_progress",
      "completed",
    ]);
  });

  it("keeps ids unique across turns, so a later burst is its own checklist", () => {
    const entries: TranscriptEntry[] = [
      create("c1", "1", "Backend"),
      {
        attachments: [],
        elements: [],
        id: "user-1",
        kind: "user",
        text: "now the titles",
      },
      create("c2", "2", "Titles"),
      update("u1", { status: "completed", taskId: "1" }),
    ];

    const plans = tasksOf(entries);

    expect(plans).toHaveLength(2);
    expect(plans[0][0].status).toBe("completed");
    expect(plans[1].map((task) => task.subject)).toEqual(["Titles"]);
  });

  it("gives each turn its own checklist", () => {
    const items = groupActivity([
      create("c1", "1", "Backend"),
      {
        attachments: [],
        elements: [],
        id: "user-1",
        kind: "user",
        text: "now the titles",
      },
      create("c2", "2", "Titles"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["tasks", "entry", "tasks"]);
  });

  it("groups entries with no task calls exactly as it did before", () => {
    const entries = [read("a", "src/A.tsx"), read("b", "src/B.tsx")];

    expect(planTasks(entries)).toEqual({
      consumed: new Set(),
      plans: new Map(),
    });
    expect(groupActivity(entries)).toEqual([{ entries, id: "a", kind: "run" }]);
  });

  it("drops an orphan update when no plan was written", () => {
    const items = groupActivity([
      update("u1", { status: "completed", taskId: "1" }),
      read("a", "src/A.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["run"]);
  });
});

describe("activeForm", () => {
  it("reads the running task's present-continuous phrase", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend", { activeForm: "Building backend" }),
      update("u1", { status: "in_progress", taskId: "1" }),
    ]);

    expect(activeForm(tasks)).toBe("Building backend");
  });

  it("falls back to the subject, and is null with nothing running", () => {
    const [tasks] = tasksOf([
      create("c1", "1", "Backend"),
      update("u1", { status: "in_progress", taskId: "1" }),
    ]);

    expect(activeForm(tasks)).toBe("Backend");
    expect(activeForm([])).toBeNull();
  });
});

describe("taskGlyph", () => {
  const row = (status: TaskRow["status"]): TaskRow => ({
    activeForm: null,
    description: null,
    id: status,
    status,
    subject: status,
  });

  it("is the running task's own status while one is running", () => {
    expect(taskGlyph([row("completed"), row("in_progress")])).toBe(
      "in_progress"
    );
  });

  it("is pending when the plan has not been started", () => {
    expect(taskGlyph([row("pending"), row("completed")])).toBe("pending");
  });

  it("is finished only when every task is completed", () => {
    expect(taskGlyph([row("completed"), row("completed")])).toBe("finished");
    expect(taskGlyph([row("completed"), row("pending")])).toBe("pending");
  });

  it("is not finished when there is no plan at all", () => {
    expect(taskGlyph([])).toBe("pending");
  });
});
