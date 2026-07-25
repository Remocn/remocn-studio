"use client";

import {
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  Trash2Icon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import type { SessionStatus } from "@/lib/studio/turns";
import { cn } from "@/lib/utils";
import type { HistorySession } from "@/shared/ipc";

export function SessionItem({
  isActive,
  onRemove,
  onSelect,
  session,
  status,
  unread,
}: {
  isActive: boolean;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  session: HistorySession;
  status: SessionStatus;
  unread: boolean;
}) {
  const busy = status === "running" || status === "waiting";

  return (
    <div className="group/session relative">
      <Button
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full flex-row text-left",
          isActive && "bg-sidebar-accent"
        )}
        onClick={onSelect}
        type="button"
        value={session.id}
        variant="ghost"
      >
        <span className="w-full truncate pr-7 text-sidebar-foreground text-sm">
          {session.title}
        </span>
      </Button>

      <Marker session={session} status={status} unread={unread} />

      {busy ? null : (
        <Button
          aria-label={`Delete ${session.title}`}
          className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/session:opacity-100"
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

function Marker({
  session,
  status,
  unread,
}: {
  session: HistorySession;
  status: SessionStatus;
  unread: boolean;
}) {
  const className =
    "pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 transition-opacity group-hover/session:opacity-0";

  if (status === "running") {
    return (
      <DotmSquare1
        ariaLabel={`${session.title} is running`}
        className={cn(className, "text-primary")}
        dotSize={2}
        size={16}
      />
    );
  }

  if (status === "waiting") {
    return (
      <CircleQuestionMarkIcon
        aria-label={`${session.title} is waiting for an answer`}
        className={cn(className, "size-3.5 text-primary")}
        role="status"
      />
    );
  }

  if (status === "failed") {
    return (
      <CircleAlertIcon
        aria-label={`${session.title} failed`}
        className={cn(className, "size-3.5 text-destructive")}
        role="status"
      />
    );
  }

  if (unread) {
    return (
      <span
        aria-label={`${session.title} has news`}
        className={cn(className, "size-1.5 rounded-full bg-primary")}
        role="status"
      />
    );
  }

  return null;
}
