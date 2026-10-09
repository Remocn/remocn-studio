"use client";

import { type ReactNode, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function PropertyDisclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="group flex min-h-7 w-full items-center gap-2 rounded-md px-1 text-left font-medium text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2">
        <ChevronRightIcon
          aria-hidden
          className="pointer-events-none size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none"
        />
        {label}
      </CollapsibleTrigger>
      <CollapsiblePanel
        className="h-auto overflow-visible pt-1 transition-none"
        hidden={!open}
        keepMounted
      >
        {children}
      </CollapsiblePanel>
    </Collapsible>
  );
}
