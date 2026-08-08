"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useElementSize } from "@/hooks/use-element-size";
import { type Dock, dockOf } from "@/lib/studio/dock";
import { type StudioSettings, saveTaskDock } from "@/lib/studio/settings";
import type { TaskRow } from "@/lib/studio/tasks";

export interface TaskDockState {
  dock: Dock;
  isOpen: boolean;
  isShown: boolean;
  ref: (node: HTMLDivElement | null) => void;
  setOpen: (open: boolean) => void;
  show: (shown: boolean) => void;
  tasks: readonly TaskRow[];
}

export function useTaskDock(
  tasks: readonly TaskRow[],
  settings: StudioSettings | null
): TaskDockState {
  const measured = useElementSize<HTMLDivElement>();
  const disclosure = useDisclosure();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const isShown = chosen ?? settings?.taskDock ?? true;

  const show = useCallback((shown: boolean) => {
    setChosen(shown);
    Effect.runFork(saveTaskDock(shown));
  }, []);

  // Hiding by hand can only ever narrow what the room allows, never widen it:
  // the block folds into the button that brings it back, and where even that
  // has no room the choice is moot.
  const dock = useMemo(() => {
    const room = dockOf(measured.size.width);
    return isShown || room.mode === "hidden"
      ? room
      : ({ mode: "icon", width: 0 } as const);
  }, [isShown, measured.size.width]);

  return useMemo(
    () => ({
      dock,
      isOpen: disclosure.isOpen && dock.mode === "icon",
      isShown,
      ref: measured.ref,
      setOpen: disclosure.setOpen,
      show,
      tasks,
    }),
    [
      disclosure.isOpen,
      disclosure.setOpen,
      dock,
      isShown,
      measured.ref,
      show,
      tasks,
    ]
  );
}
