"use client";

import type { ReactNode } from "react";
import { ChevronUpIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function DockStack({ children }: { children: ReactNode }) {
  return (
    // The stack has no bottom radius and no gap under it: it abuts the composer
    // and reads as a drawer behind it. Overlapping the composer to get that
    // effect is what the earlier version did, and every version of it put an
    // edge or a shadow of ours across the input. Both live in the same
    // `max-w-2xl` column, so a pane resize reflows them together and there is
    // nothing left to measure.
    <div className="relative z-0 -mb-px shrink-0 px-4">
      {/* `px-3` inside the composer's own column is what makes the strip
          narrower than it, so it reads as coming out from behind. */}
      <div className="mx-auto w-full max-w-2xl px-3">
        <div className="overflow-hidden rounded-t-lg bg-muted empty:hidden dark:bg-card">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DockSection({
  children,
  count,
  icon,
  isExpanded,
  label,
  onToggle,
  summary,
}: {
  children: ReactNode;
  count: string;
  icon: ReactNode;
  isExpanded: boolean;
  label: ReactNode;
  onToggle: () => void;
  summary: string;
}) {
  return (
    <div>
      {isExpanded ? (
        <div className="grid animate-drawer-in grid-rows-[1fr]">
          <div className="min-h-0 overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-1.5 pb-0">
              {children}
            </div>
          </div>
        </div>
      ) : null}

      <button
        aria-expanded={isExpanded}
        aria-label={summary}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2 active:bg-accent"
        onClick={onToggle}
        type="button"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
        <ChevronUpIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>
    </div>
  );
}
