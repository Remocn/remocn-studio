"use client";

import type { ToolTarget } from "@/lib/studio/activity";
import { cn } from "@/lib/utils";

export function ActivityTarget({ target }: { target: ToolTarget }) {
  return (
    <span className="flex min-w-0 items-baseline">
      {target.lead === "" ? null : (
        <span className="min-w-0 shrink-[9999] truncate text-left text-muted-foreground [direction:rtl]">
          <bdi>{target.lead}</bdi>
        </span>
      )}
      <span
        className={cn(
          "text-foreground",
          target.kind === "path" ? "shrink-0" : "truncate"
        )}
      >
        {target.name}
      </span>
    </span>
  );
}
