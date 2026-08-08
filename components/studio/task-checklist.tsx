"use client";

import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotDashedIcon,
  type LucideIcon,
} from "lucide-react";
import { useDisclosure } from "@/hooks/use-disclosure";
import type { TaskRow, TaskStatus } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";

const ICONS: Record<TaskStatus, LucideIcon> = {
  completed: CircleCheckIcon,
  in_progress: CircleDotDashedIcon,
  pending: CircleDashedIcon,
};

const STATES: Record<TaskStatus, string> = {
  completed: "text-muted-foreground",
  in_progress: "animate-pulse text-amber-500",
  pending: "text-muted-foreground/60",
};

const LABELS: Record<TaskStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  pending: "Pending",
};

export function TaskChecklist({ tasks }: { tasks: readonly TaskRow[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ul className="flex min-w-0 flex-col gap-1" data-slot="task-checklist">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}

function TaskItem({ task }: { task: TaskRow }) {
  const disclosure = useDisclosure();
  const Icon = ICONS[task.status];

  return (
    <li className="flex min-w-0 flex-col gap-1">
      <button
        aria-expanded={
          task.description === null ? undefined : disclosure.isOpen
        }
        className="group flex w-full min-w-0 items-center gap-2 rounded-md text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
        disabled={task.description === null}
        onClick={disclosure.toggle}
        type="button"
      >
        <Icon
          aria-label={LABELS[task.status]}
          className={cn("size-3.5 shrink-0", STATES[task.status])}
        />
        <span
          className={cn(
            "min-w-0 truncate",
            task.status === "completed"
              ? "text-muted-foreground line-through"
              : "text-foreground"
          )}
        >
          {task.subject}
        </span>
      </button>

      {disclosure.isOpen && task.description !== null ? (
        <p className="wrap-break-word whitespace-pre-wrap pl-5 text-[0.6875rem] text-muted-foreground">
          {task.description}
        </p>
      ) : null}
    </li>
  );
}
