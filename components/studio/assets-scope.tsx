"use client";

import { FolderIcon, ImageIcon, VideoIcon } from "lucide-react";
import type { AssetScope, AssetsScope } from "@/hooks/use-assets-scope";
import { cn } from "@/lib/utils";

const SCOPE_LABELS: Record<AssetScope, string> = {
  library: "Library",
  photo: "Photos",
  video: "Videos",
};

const SCOPE_ICONS = {
  library: FolderIcon,
  photo: ImageIcon,
  video: VideoIcon,
} as const;

// One three-way control instead of two stacked toggles: where assets come
// from and which stock kind are a single choice, and the control shares the
// search field's height and ring so the header reads as one family.
export function AssetsScopeSwitch({ scope }: { scope: AssetsScope }) {
  return (
    <div className="px-1 pb-2">
      <div className="flex h-9 rounded-md bg-input/30 p-0.5 ring-1 ring-border ring-inset">
        {(["library", "photo", "video"] as const).map((entry) => {
          const Icon = SCOPE_ICONS[entry];
          return (
            <button
              aria-pressed={scope.scope === entry}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                scope.scope === entry
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={entry}
              onClick={scope.onPick}
              type="button"
              value={entry}
            >
              <Icon aria-hidden className="size-3.5 shrink-0" />
              {SCOPE_LABELS[entry]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
