"use client";

import { type MouseEvent, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { recentProjects } from "@/lib/studio/workspace-lists";
import { ProjectItem } from "./project-item";
import { useStudio } from "./studio-provider";

export function ProjectBrowser() {
  const {
    activeProject,
    closeLibrary,
    isLoadingProjects,
    projects,
    projectsError,
    reloadProjects,
    selectProject,
    sessions,
  } = useStudio();
  const sortedProjects = useMemo(
    () => recentProjects(projects, sessions),
    [projects, sessions]
  );
  const onSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const projectId = event.currentTarget.value;
      if (projectId !== activeProject?.id) {
        selectProject(projectId);
      }
      closeLibrary();
    },
    [activeProject?.id, closeLibrary, selectProject]
  );
  const emptyMessage = isLoadingProjects
    ? "Loading projects…"
    : "Create or open your first project.";

  return (
    <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3">
      {projectsError === null ? null : (
        <div className="px-2 py-2 text-muted-foreground text-xs" role="alert">
          <p>The project list could not be read.</p>
          <Button
            className="mt-2"
            onClick={reloadProjects}
            size="xs"
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      )}
      {sortedProjects.map((project) => (
        <ProjectItem
          active={project.id === activeProject?.id}
          key={project.id}
          onSelect={onSelect}
          project={project}
        />
      ))}
      {sortedProjects.length === 0 && projectsError === null ? (
        <p className="px-2 py-2 text-muted-foreground text-xs" role="status">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}
