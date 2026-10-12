"use client";

import type { MouseEvent, ReactNode } from "react";
import { memo, useId } from "react";
import {
  CircleQuestionMarkIcon,
  MessageSquareIcon,
  Trash2Icon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import { useChatRowMenu } from "@/hooks/use-row-menus";
import { type SessionRow, sessionMeta } from "@/lib/studio/groups";
import { relativeTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";

interface RowProps {
  compact?: boolean;
  isActive: boolean;
  now: number;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  row: SessionRow;
}

function SessionItemBlock(props: RowProps) {
  const { now, row } = props;
  const meta = sessionMeta(row, now);
  const metaId = useId();

  return (
    <RowShell
      {...props}
      marker={<Marker compact={props.compact} row={row} />}
      meta={
        meta === null ? null : (
          <p
            className={cn(
              "truncate text-xs tabular-nums",
              meta.isError ? "text-destructive" : "text-muted-foreground",
              props.compact && "sr-only"
            )}
            id={metaId}
          >
            {meta.text}
          </p>
        )
      }
      metaId={meta === null ? null : metaId}
      time={
        meta === null && !props.compact
          ? relativeTime(row.session.updatedAt, now)
          : null
      }
    />
  );
}

export const SessionItem = memo(SessionItemBlock);

const MATRIX_COLORS = {
  failed: "var(--destructive)",
  idle: "var(--success)",
  running: "var(--key-action)",
  waiting: "var(--sidebar-primary)",
};

function RowShell({
  compact,
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
  const titleId = useId();
  const menu = useChatRowMenu(!busy);

  return (
    <div className="group/session relative" data-chat-row>
      <div
        className={cn(
          "rounded-md py-1.5 pr-8 pl-7 text-sm",
          compact && "h-7 py-1 pl-8 leading-5",
          isActive ? "bg-sidebar-accent" : "group-hover/session:bg-accent"
        )}
      >
        <div className="flex items-baseline gap-2">
          {/* Not `text-sidebar-foreground/65`: that token is itself a 64% mix
              toward the ground, so the fade compounded to ~42% of the way from
              the background to the ink — 2.5:1 in light, 3.8:1 in dark, both
              under AA's 4.5:1 for 14px text, and both *behind* the timestamp
              beside it. The active row carries the emphasis instead; the row's
              own background is what separates it. */}
          <div
            className={cn(
              "min-w-0 flex-1 truncate",
              isActive || row.unread
                ? "text-sidebar-foreground"
                : "text-muted-foreground"
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
        aria-keyshortcuts={busy ? undefined : "Meta+Backspace"}
        aria-labelledby={titleId}
        className="absolute inset-0 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
        data-row-action="open"
        onClick={onSelect}
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        type="button"
        value={session.id}
      />

      {busy ? null : (
        <Button
          aria-label={`Delete ${session.title}`}
          className={cn(
            "absolute top-1 right-1 z-10 opacity-0 pointer-coarse:opacity-100 focus-visible:opacity-100 group-hover/session:opacity-100",
            compact && "top-0.5"
          )}
          data-row-action="delete"
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

function Marker({ compact, row }: { compact?: boolean; row: SessionRow }) {
  const label = statusLabel(row);
  // `left-1.5` puts the marker in the same column as the project row's chevron,
  // so a session and its project share one icon gutter.
  const className = cn(
    "pointer-events-none absolute top-2 left-1.5 shrink-0",
    compact && "top-1.5 left-2"
  );

  if (label === null) {
    if (compact) {
      return (
        <MessageSquareIcon
          className={cn(className, "size-4 text-muted-foreground")}
        />
      );
    }
    return (
      <DotmSquare1
        animated={false}
        ariaLabel=""
        className={cn(className, "text-muted-foreground/35")}
        dotSize={2}
        size={16}
      />
    );
  }

  // `role="img"`, not `role="status"`: a live region per row would re-announce
  // as `paneGroups` promotes rows, and one with no text content never announces
  // reliably anyway. The label still names the state when the row is read.
  if (row.status === "running" || row.status === "failed" || row.completed) {
    return (
      <DotmSquare1
        animated={row.status === "running"}
        ariaLabel={label}
        className={className}
        color={MATRIX_COLORS[row.status]}
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

  return (
    <span
      aria-label={label}
      className={cn(
        className,
        "top-3 left-2.5 size-2 rounded-full bg-sidebar-primary"
      )}
      data-unread=""
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
  if (row.completed) {
    return `${session.title} completed successfully${unread ? " — unread" : ""}`;
  }

  return unread ? `${session.title} has news` : null;
}
