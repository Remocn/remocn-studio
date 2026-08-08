"use client";

import { useDisclosure } from "@/hooks/use-disclosure";
import type { TaskRow } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";
import { TaskStatusIcon } from "./task-status-icon";

export function TaskChecklist({ tasks }: { tasks: readonly TaskRow[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ul className="flex min-w-0 flex-col gap-0.5" data-slot="task-checklist">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}

function TaskItem({ task }: { task: TaskRow }) {
  const disclosure = useDisclosure();

  return (
    <li className="flex min-w-0 flex-col">
      <button
        aria-expanded={
          task.description === null ? undefined : disclosure.isOpen
        }
        className={cn(
          "group flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default",
          task.status === "in_progress" && "bg-muted/60"
        )}
        disabled={task.description === null}
        onClick={disclosure.toggle}
        type="button"
      >
        <TaskStatusIcon className="mt-0.5" glyph={task.status} />
        {/* The subject wraps rather than truncating: a plan whose rows end in
            an ellipsis is a plan you cannot read, and the block is free to
            grow downwards where it is not free to grow sideways. */}
        <span
          className={cn(
            "wrap-break-word min-w-0 text-pretty leading-snug",
            task.status === "completed"
              ? "text-muted-foreground line-through decoration-muted-foreground/50"
              : "text-foreground"
          )}
        >
          {task.subject}
        </span>
      </button>

      {disclosure.isOpen && task.description !== null ? (
        <p className="wrap-break-word whitespace-pre-wrap px-2 pb-1.5 pl-8 text-muted-foreground text-xs leading-relaxed">
          {task.description}
        </p>
      ) : null}
    </li>
  );
}
