"use client";

import { Trash2Icon } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { baseName } from "@/lib/studio/paths";
import { relativeTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";
import type { HistorySession } from "@/shared/ipc";

export function SessionItem({
  isActive,
  now,
  onRemove,
  onSelect,
  session,
}: {
  isActive: boolean;
  now: number;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  session: HistorySession;
}) {
  return (
    <div className="group/session relative">
      <button
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/30",
          isActive && "bg-sidebar-accent"
        )}
        onClick={onSelect}
        type="button"
        value={session.id}
      >
        <span className="w-full truncate pr-7 text-sidebar-foreground text-sm">
          {session.title}
        </span>
        <span className="w-full truncate pr-7 text-muted-foreground text-xs">
          {`${baseName(session.folder)} · ${relativeTime(session.updatedAt, now)}`}
        </span>
      </button>

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
    </div>
  );
}
