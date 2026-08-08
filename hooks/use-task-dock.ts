"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { type StudioSettings, saveTaskDock } from "@/lib/studio/settings";

export interface TaskDockState {
  isExpanded: boolean;
  toggle: () => void;
}

export function useTaskDock(settings: StudioSettings | null): TaskDockState {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const isExpanded = chosen ?? settings?.taskDock ?? false;

  const toggle = useCallback(() => {
    const next = !isExpanded;
    setChosen(next);
    Effect.runFork(saveTaskDock(next));
  }, [isExpanded]);

  return useMemo(() => ({ isExpanded, toggle }), [isExpanded, toggle]);
}
