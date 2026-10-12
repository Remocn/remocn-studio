"use client";

import { TabsPrimitive } from "@/components/ui/tabs";
import { useWheelScroll } from "@/hooks/use-wheel-scroll";
import type { DocumentTab } from "@/lib/studio/documents";
import { cn } from "@/lib/utils";
import { FileIcon } from "./file-icon";

/**
 * A file manager's tab strip: a flat band under the pane header, tabs pushed
 * left, the open one wearing the document's own background so the two read
 * as one surface.
 *
 * It is built on the Base UI primitive rather than on `components/ui/tabs.tsx`
 * — a `shadcn add` re-add rewrites that file, and this shape is not the
 * segmented control that lives there. The indicator is deliberately unused: it
 * slides between pills, and there are no pills here; `data-active` carries the
 * open tab instead.
 */
export function DocTabs({ tabs }: { tabs: readonly DocumentTab[] }) {
  // Six tabs do not fit a 360px pane and the strip carries no scrollbar to
  // grab, so a plain mouse reaches the clipped ones by wheel.
  const strip = useWheelScroll<HTMLDivElement>();

  return (
    <div
      className="shrink-0 overflow-x-auto overflow-y-hidden bg-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      ref={strip.ref}
    >
      <div className="flex min-w-full items-stretch">
        <TabsPrimitive.List className="flex items-stretch" data-slot="doc-tabs">
          {tabs.map((tab) => (
            <TabsPrimitive.Tab
              className={cn(
                "relative flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap px-3 text-muted-foreground text-xs outline-none transition-[color,background-color] duration-fast ease-out",
                "hover:bg-accent hover:text-foreground",
                "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2",
                "data-active:bg-background data-active:text-foreground"
              )}
              key={tab.file.path}
              title={tab.title ?? tab.file.name}
              value={tab.file.path}
            >
              <FileIcon className="size-3.5 shrink-0" path={tab.file.name} />
              {tab.file.name}
            </TabsPrimitive.Tab>
          ))}
        </TabsPrimitive.List>
      </div>
    </div>
  );
}
