"use client";

import {
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  Trash2Icon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { memo } from "react";
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

function SessionItemBlock(props: RowProps) {
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
            id={`session-meta-${row.session.id}`}
          >
            {meta.text}
          </p>
        )
      }
      metaId={meta === null ? null : `session-meta-${row.session.id}`}
      time={meta === null ? relativeTime(row.session.updatedAt, now) : null}
    />
  );
}

export const SessionItem = memo(SessionItemBlock);

function RowShell({
  isActive,
  marker,
  meta,
  metaId,
  onRemove,
  onSelect,
  row,
  time,
}: RowProps & {
  marker: ReactNode;
  meta: ReactNode;
  metaId: string | null;
  time: string | null;
}) {
  const { session, status } = row;
  const busy = status === "running" || status === "waiting";
  const titleId = `session-title-${session.id}`;

  return (
    <div className="group/session relative">
      <div
        className={cn(
          "rounded-md py-1.5 pr-8 pl-7 text-sm",
          isActive
            ? "bg-sidebar-accent/60"
            : "group-hover/session:bg-sidebar-accent/40"
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
        aria-describedby={metaId ?? undefined}
        aria-labelledby={titleId}
        className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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

  // `role="img"`, not `role="status"`: a live region per row would re-announce
  // as `paneGroups` promotes rows, and one with no text content never announces
  // reliably anyway. The label still names the state when the row is read.
  if (row.status === "running") {
    return (
      <DotmSquare1
        ariaLabel={label}
        className={cn(className, "text-sidebar-primary")}
        dotSize={2}
        role="img"
        size={16}
      />
    );
  }

  if (row.status === "waiting") {
    return (
      <CircleQuestionMarkIcon
        aria-label={label}
        className={cn(className, "size-4 text-sidebar-primary")}
        role="img"
      />
    );
  }

  if (row.status === "failed") {
    return (
      <CircleAlertIcon
        aria-label={label}
        className={cn(className, "size-4 text-destructive")}
        role="img"
      />
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(
        className,
        "top-3.5 left-3 size-1.5 rounded-full bg-sidebar-primary"
      )}
      role="img"
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
