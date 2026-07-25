"use client";

import { Trash2Icon } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import { cn } from "@/lib/utils";
import type { HistorySession } from "@/shared/ipc";

export function SessionItem({
  isActive,
  isThinking,
  onRemove,
  onSelect,
  session,
}: {
  isActive: boolean;
  isThinking: boolean;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  session: HistorySession;
}) {
  return (
    <div className="group/session relative">
      <button
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full flex-row items-start gap-0.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/30",
          isActive && "bg-sidebar-accent"
        )}
        onClick={onSelect}
        type="button"
        value={session.id}
      >
        <span className="w-full truncate pr-7 text-sidebar-foreground text-sm">
          {session.title}
        </span>
      </button>

      {isThinking ? (
        <DotmSquare1
          ariaLabel={`${session.title} is running`}
          className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-primary transition-opacity group-hover/session:opacity-0"
          dotSize={2}
          size={16}
        />
      ) : null}

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
