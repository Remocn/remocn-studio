"use client";

import { FolderIcon, ImageIcon, VideoIcon } from "@/components/icons";
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

// Keep source selection compact; search below owns the available width.
export function AssetsScopeSwitch({
  scope,
  vertical = false,
}: {
  scope: AssetsScope;
  vertical?: boolean;
}) {
  return (
    <nav aria-label="Asset sources" className={vertical ? "" : "px-1"}>
      <div
        className={
          vertical
            ? "flex flex-col"
            : "grid min-h-7 grid-cols-3 items-center gap-1"
        }
      >
        {(["library", "photo", "video"] as const).map((entry) => {
          const Icon = SCOPE_ICONS[entry];
          return (
            <button
              aria-pressed={scope.scope === entry}
              className={cn(
                "flex h-7 pointer-coarse:h-11 items-center justify-center gap-1 rounded-md px-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2",
                vertical && "justify-start! w-full gap-2",
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
    </nav>
  );
}
