"use client";

import { MinusIcon, SquareIcon, XIcon } from "lucide-react";
import { usePlatform } from "@/hooks/use-platform";
import { useWindowControls } from "@/hooks/use-window-controls";
import { cn } from "@/lib/utils";

const CONTROL =
  "flex size-5 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 outline-none transition-colors duration-fast hover:bg-foreground/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3";

// The window carries no frame of its own, so its controls sit in the slot the
// title bar band keeps clear at the top left — above the sidebar's brand row,
// or beside the chat header's inset when the sidebar is hidden.
export function WindowControls() {
  const platform = usePlatform();
  const controls = useWindowControls();

  if (platform !== "linux") {
    return null;
  }

  return (
    <div
      className="fixed top-4.5 left-2.5 z-60 flex items-center gap-1"
      data-slot="window-controls"
    >
      <button
        aria-label="Close"
        className={cn(CONTROL, "hover:bg-destructive hover:text-white")}
        onClick={controls.onClose}
        type="button"
      >
        <XIcon />
      </button>
      <button
        aria-label="Minimise"
        className={CONTROL}
        onClick={controls.onMinimize}
        type="button"
      >
        <MinusIcon />
      </button>
      <button
        aria-label="Maximise"
        className={CONTROL}
        onClick={controls.onToggleMaximize}
        type="button"
      >
        <SquareIcon />
      </button>
    </div>
  );
}
