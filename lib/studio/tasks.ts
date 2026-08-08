import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";

export type TaskStatus = "completed" | "in_progress" | "pending";

export interface TaskRow {
  activeForm: string | null;
  description: string | null;
  id: string;
  status: TaskStatus;
  subject: string;
}

export interface TaskProgress {
  done: number;
  total: number;
}

export interface TaskPlans {
  consumed: ReadonlySet<string>;
  plans: ReadonlyMap<string, readonly TaskRow[]>;
}

const CREATE = "TaskCreate";
const UPDATE = "TaskUpdate";

const CREATED_ID = /task\s*#(\d+)/i;

const STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "deleted",
  "in_progress",
  "pending",
]);

type Transition = TaskStatus | "deleted";

const EMPTY: TaskPlans = { consumed: new Set(), plans: new Map() };

export function planTasks(entries: readonly TranscriptEntry[]): TaskPlans {
  const consumed = new Set<string>();
  // The rows are the *session's* task list, not the turn's: the tool numbers
  // ids sequentially for the whole session, and a plan written in one turn is
  // routinely moved by updates in the next one. Only where a plan is *anchored*
  // is per turn — a later burst of creates opens its own checklist, in the
  // order the conversation happened, and an update reaches its task wherever
  // that task was written.
  const rows = new Map<string, TaskRow>();
  const order = new Map<string, string[]>();

  let anchor: string | null = null;
  let created_ = 0;

  for (const entry of entries) {
    if (entry.kind === "user") {
      anchor = null;
      continue;
    }

    if (!isTaskCall(entry)) {
      continue;
    }

    if (entry.name === CREATE) {
      const row = created(entry, created_);
      if (row === null) {
        continue;
      }

      created_ += 1;
      consumed.add(entry.id);

      if (anchor === null) {
        anchor = entry.id;
        order.set(anchor, []);
      }

      if (!rows.has(row.id)) {
        order.get(anchor)?.push(row.id);
      }
      rows.set(row.id, row);
      continue;
    }

    if (apply(rows, entry.input)) {
      consumed.add(entry.id);
    }
  }

  const plans = new Map<string, readonly TaskRow[]>();
  for (const [at, ids] of order) {
    plans.set(
      at,
      ids.flatMap((id) => rows.get(id) ?? [])
    );
  }

  return plans.size === 0 ? EMPTY : { consumed, plans };
}

export function currentTasks(
  entries: readonly TranscriptEntry[]
): readonly TaskRow[] {
  const plans = [...planTasks(entries).plans.values()];
  return plans.at(-1) ?? [];
}

export function taskProgress(tasks: readonly TaskRow[]): TaskProgress | null {
  if (tasks.length === 0) {
    return null;
  }

  return {
    done: tasks.filter((task) => task.status === "completed").length,
    total: tasks.length,
  };
}

export type TaskGlyph = TaskStatus | "finished";

export function taskGlyph(tasks: readonly TaskRow[]): TaskGlyph {
  if (tasks.length > 0 && tasks.every((task) => task.status === "completed")) {
    return "finished";
  }

  return activeTask(tasks) === null ? "pending" : "in_progress";
}

export function activeTask(tasks: readonly TaskRow[]): TaskRow | null {
  return tasks.find((task) => task.status === "in_progress") ?? null;
}

export function activeForm(tasks: readonly TaskRow[]): string | null {
  const running = activeTask(tasks);
  return running === null ? null : (running.activeForm ?? running.subject);
}

function created(entry: ActivityEntry, index: number): TaskRow | null {
  const input = fields(entry.input);
  const subject = string(input, "subject");

  if (subject === null) {
    return null;
  }

  return {
    activeForm: string(input, "activeForm"),
    description: string(input, "description"),
    id: identify(entry.result) ?? String(index + 1),
    status: "pending",
    subject,
  };
}

function apply(rows: Map<string, TaskRow>, input: unknown): boolean {
  const record = fields(input);
  const id = string(record, "taskId");
  const row = id === null ? undefined : rows.get(id);

  if (id === null || row === undefined) {
    return false;
  }

  const status = status_(record);

  if (status === "deleted") {
    rows.delete(id);
    return true;
  }

  rows.set(id, {
    activeForm: string(record, "activeForm") ?? row.activeForm,
    description: string(record, "description") ?? row.description,
    id,
    status: status ?? row.status,
    subject: string(record, "subject") ?? row.subject,
  });

  return true;
}

function identify(result: string | null): string | null {
  const found = result === null ? null : CREATED_ID.exec(result);
  return found === null ? null : found[1];
}

function isTaskCall(entry: TranscriptEntry): entry is ActivityEntry {
  return (
    entry.kind === "activity" &&
    entry.state !== "failed" &&
    (entry.name === CREATE || entry.name === UPDATE)
  );
}

function status_(record: Record<string, unknown>): Transition | null {
  const value = record.status;
  return typeof value === "string" && STATUSES.has(value)
    ? (value as Transition)
    : null;
}

function fields(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

function string(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
