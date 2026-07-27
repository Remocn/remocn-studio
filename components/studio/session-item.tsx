"use client";

import {
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  Trash2Icon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import { type SessionRow, sessionMeta } from "@/lib/studio/groups";
import { relativeTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";

interface RowProps {
  isActive: boolean;
  now: number;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  row: SessionRow;
}

export function SessionItem(props: RowProps) {
  const { now, row } = props;
  const meta = sessionMeta(row, now);

  return (
    <RowShell
      {...props}
      marker={<Marker row={row} />}
      meta={
        meta === null ? null : (
          <p
            className={cn(
              "truncate text-xs tabular-nums",
              meta.isError ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {meta.text}
          </p>
        )
      }
      time={meta === null ? relativeTime(row.session.updatedAt, now) : null}
    />
  );
}

function RowShell({
  isActive,
  marker,
  meta,
  onRemove,
  onSelect,
  row,
  time,
}: RowProps & {
  marker: ReactNode;
  meta: ReactNode;
  time: string | null;
}) {
  const { session, status } = row;
  const busy = status === "running" || status === "waiting";
  const titleId = `session-title-${session.id}`;

  return (
    <div className="group/session relative">
      <div
        className={cn(
          "rounded-lg py-1.5 pr-8 pl-7 text-sm",
          isActive ? "bg-sidebar-accent" : "group-hover/session:bg-muted/60"
        )}
      >
        <div className="flex items-baseline gap-2">
          <div
            className={cn(
              "min-w-0 flex-1 truncate",
              isActive
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/65"
            )}
            id={titleId}
          >
            {session.title}
          </div>
          {time === null ? null : (
            <div className="shrink-0 text-muted-foreground text-xs tabular-nums">
              {time}
            </div>
          )}
        </div>

        {meta}
      </div>

      {marker}

      <button
        aria-current={isActive ? "true" : undefined}
        aria-labelledby={titleId}
        className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        onClick={onSelect}
        type="button"
        value={session.id}
      />

      {busy ? null : (
        <Button
          aria-label={`Delete ${session.title}`}
          className="absolute top-1 right-1 z-10 opacity-0 focus-visible:opacity-100 group-hover/session:opacity-100"
          onClick={onRemove}
          size="icon-xs"
          value={session.id}
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}

function Marker({ row }: { row: SessionRow }) {
  const label = statusLabel(row);
  // `left-1.5` puts the marker in the same column as the project row's chevron,
  // so a session and its project share one icon gutter.
  const className = "pointer-events-none absolute top-2 left-1.5 shrink-0";

  if (label === null) {
    return null;
  }

  if (row.status === "running") {
    return (
      <DotmSquare1
        ariaLabel={label}
        className={cn(className, "text-primary")}
        dotSize={2}
        size={16}
      />
    );
  }

  if (row.status === "waiting") {
    return (
      <CircleQuestionMarkIcon
        aria-label={label}
        className={cn(className, "size-4 text-primary")}
        role="status"
      />
    );
  }

  if (row.status === "failed") {
    return (
      <CircleAlertIcon
        aria-label={label}
        className={cn(className, "size-4 text-destructive")}
        role="status"
      />
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(
        className,
        "top-3.5 left-3 size-1.5 rounded-full bg-primary"
      )}
      role="status"
    />
  );
}

function statusLabel(row: SessionRow): string | null {
  const { session, status, unread } = row;

  if (status === "running") {
    return `${session.title} is running`;
  }
  if (status === "waiting") {
    return `${session.title} is waiting for an answer`;
  }
  if (status === "failed") {
    return `${session.title} failed`;
  }

  return unread ? `${session.title} has news` : null;
}
