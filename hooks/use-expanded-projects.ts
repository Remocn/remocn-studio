"use client";

import { Effect } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type StudioSettings,
  saveExpandedProjects,
} from "@/lib/studio/settings";

export interface ExpandedProjects {
  expandedProjects: ReadonlySet<string>;
  expandProject: (projectId: string) => void;
  onToggleProject: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function useExpandedProjects(
  settings: StudioSettings | null,
  activeProjectId: string | null
): ExpandedProjects {
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const opened = useRef<string | null>(null);
  const stored = settings?.expandedProjects ?? [];
  const remembered = chosen ?? stored;

  const keep = useCallback((ids: readonly string[]) => {
    setChosen(ids);
    Effect.runFork(saveExpandedProjects(ids));
  }, []);

  const expandProject = useCallback(
    (projectId: string) => {
      if (remembered.includes(projectId)) {
        return;
      }
      keep([...remembered, projectId]);
    },
    [keep, remembered]
  );

  const onToggleProject = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const projectId = event.currentTarget.value;
      keep(
        remembered.includes(projectId)
          ? remembered.filter((id) => id !== projectId)
          : [...remembered, projectId]
      );
    },
    [keep, remembered]
  );

  useEffect(() => {
    if (activeProjectId === null || opened.current === activeProjectId) {
      return;
    }
    opened.current = activeProjectId;
    expandProject(activeProjectId);
  }, [activeProjectId, expandProject]);

  const expandedProjects = useMemo(() => new Set(remembered), [remembered]);

  return useMemo(
    () => ({ expandedProjects, expandProject, onToggleProject }),
    [expandProject, expandedProjects, onToggleProject]
  );
}
