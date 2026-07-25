"use client";

import { FolderOpenIcon, FolderPlusIcon, PlusIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNewProject } from "@/hooks/use-new-project";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ProjectGroup as Group } from "@/lib/studio/groups";
import { NewProjectDialog } from "./new-project-dialog";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { ProjectGroup } from "./project-group";
import { useStudio } from "./studio-provider";

const PLACEHOLDERS = ["one", "two", "three", "four"];

export function ProjectsPane() {
  const {
    actionError,
    activeSession,
    createProject,
    expandedProjects,
    groups,
    isLoadingProjects,
    isThinking,
    onNewSession,
    onRemoveSession,
    onSelectSession,
    onToggleProject,
    openFolder,
    projectsError,
    relocateProject,
    reloadProjects,
    removeProject,
    renameProject,
    sessionsError,
  } = useStudio();

  const newProject = useNewProject(createProject);
  const commands: ProjectCommands = {
    relocateProject,
    removeProject,
    renameProject,
  };

  return (
    <Pane className="bg-sidebar">
      <PaneHeader>
        <PaneTitle>Projects</PaneTitle>
        <PaneActions>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  />
                }
              >
                <PlusIcon />
                <span className="sr-only">Add a project</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Add a project</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={openFolder}>
                <FolderOpenIcon />
                Open folder…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={newProject.open}>
                <FolderPlusIcon />
                New project…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PaneActions>
      </PaneHeader>

      <PaneBody>
        <ProjectsBody
          activeSessionId={activeSession?.id ?? null}
          commands={commands}
          error={projectsError ?? sessionsError}
          expanded={expandedProjects}
          groups={groups}
          isLoading={isLoadingProjects}
          isThinking={isThinking}
          onNewSession={onNewSession}
          onOpenFolder={openFolder}
          onRemoveSession={onRemoveSession}
          onRetry={reloadProjects}
          onSelectSession={onSelectSession}
          onToggle={onToggleProject}
        />

        {actionError === null ? null : (
          <p className="shrink-0 break-words px-3 py-2 text-destructive text-xs">
            {actionError}
          </p>
        )}
      </PaneBody>

      <NewProjectDialog control={newProject} />
    </Pane>
  );
}

function ProjectsBody({
  activeSessionId,
  commands,
  error,
  expanded,
  groups,
  isLoading,
  isThinking,
  onNewSession,
  onOpenFolder,
  onRemoveSession,
  onRetry,
  onSelectSession,
  onToggle,
}: {
  activeSessionId: string | null;
  commands: ProjectCommands;
  error: string | null;
  expanded: ReadonlySet<string>;
  groups: readonly Group[];
  isLoading: boolean;
  isThinking: boolean;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenFolder: () => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (error !== null) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyTitle>History is unavailable</EmptyTitle>
          <EmptyDescription className="break-words">{error}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </Empty>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {PLACEHOLDERS.map((placeholder) => (
          <Skeleton className="h-8 w-full rounded-lg" key={placeholder} />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            Point the studio at a Remotion project to begin.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onOpenFolder} size="sm" variant="outline">
          <FolderOpenIcon data-icon="inline-start" />
          Open folder
        </Button>
      </Empty>
    );
  }

  return (
    <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
      {groups.map((group) => (
        <li key={group.project.id}>
          <ProjectGroup
            activeSessionId={activeSessionId}
            commands={commands}
            isExpanded={expanded.has(group.project.id)}
            isThinking={isThinking}
            onNewSession={onNewSession}
            onRemoveSession={onRemoveSession}
            onSelectSession={onSelectSession}
            onToggle={onToggle}
            project={group.project}
            sessions={group.sessions}
          />
        </li>
      ))}
    </ol>
  );
}
