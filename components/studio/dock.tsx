"use client";

import { ChevronUpIcon } from "lucide-react";
import type { ReactNode } from "react";
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
        {/* In dark, `bg-card` rather than a muted tint: the composer's own
            surface is a translucent lift over the background, so anything
            translucent there lands on the same colour and the two merge — the
            colour is the whole separation, since the dark composer draws no
            border. In light `--card` equals the background, so the drawer is a
            muted well behind the composer's bordered field instead. The radius
            is the stack's, not each section's, so two sections stack into one
            drawer rather than leaving a notch where their corners meet. */}
        <div className="divide-y divide-border/50 overflow-hidden rounded-t-xl bg-muted empty:hidden dark:bg-card">
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
        <div className="max-h-64 overflow-y-auto p-1.5 pb-0">{children}</div>
      ) : null}

      <button
        aria-expanded={isExpanded}
        aria-label={summary}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-foreground/10"
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
