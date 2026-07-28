"use client";

import {
  FolderOpenIcon,
  FolderPlusIcon,
  Search,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNewProject } from "@/hooks/use-new-project";
import { useNow } from "@/hooks/use-now";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import type { PaneGroup } from "@/lib/studio/groups";
import { LogoWordmark } from "./logo-mark";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectGroup } from "./project-group";
import { useStudio } from "./studio-provider";

const PLACEHOLDERS = ["one", "two", "three", "four"];

export function ProjectsPane() {
  const {
    actionError,
    activeProject,
    activeSession,
    createProject,
    expandedProjects,
    folderError,
    groups,
    isLoadingProjects,
    onNewSession,
    onRemoveSession,
    onRetryScaffold,
    onSelectSession,
    onToggleProject,
    openFolder,
    projectsError,
    relocateProject,
    reloadProjects,
    removeProject,
    renameProject,
    scaffolds,
    sessionsError,
    startSession,
  } = useStudio();

  const now = useNow();
  const newProject = useNewProject(createProject);
  const paneError = actionError ?? folderError;
  const commands: ProjectCommands = {
    relocateProject,
    removeProject,
    renameProject,
  };

  return (
    // `collapsible="none"` is what makes this a sidebar inside a resizable
    // panel rather than one fixed to the window: it drops the off-canvas gap
    // element and the mobile Sheet, and renders a plain flex column. The
    // provider is still required — every menu part reads its context.
    <SidebarProvider className="h-full min-h-0">
      <Sidebar className="w-full" collapsible="none">
        <SidebarHeader className="gap-0 p-0">
          <div
            className="h-(--titlebar-block-inset) shrink-0"
            data-tauri-drag-region
          />
          <SidebarBrand
            canStart={activeProject !== null}
            onNewSession={startSession}
          />
          <SidebarSearch />
          <SidebarActions onNewProject={newProject.open} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <h2 className="sr-only">Projects</h2>

            <SidebarGroupContent>
              <ProjectsBody
                activeSessionId={activeSession?.id ?? null}
                commands={commands}
                error={projectsError ?? sessionsError}
                expanded={expandedProjects}
                groups={groups}
                isLoading={isLoadingProjects}
                now={now}
                onNewSession={onNewSession}
                onOpenFolder={openFolder}
                onRemoveSession={onRemoveSession}
                onRetry={reloadProjects}
                onRetryScaffold={onRetryScaffold}
                onSelectSession={onSelectSession}
                onToggle={onToggleProject}
                scaffolds={scaffolds}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {paneError === null ? null : (
          <p className="shrink-0 break-words px-3 py-2 text-destructive text-xs">
            {paneError}
          </p>
        )}

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="text-muted-foreground" disabled>
                <SettingsIcon />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <NewProjectDialog control={newProject} />
      </Sidebar>
    </SidebarProvider>
  );
}

// The traffic lights are cleared by the header's top inset, above this row, so
// the wordmark can sit on the same left edge as the group label and the project
// names below it rather than being pushed out of the column.
function SidebarBrand({
  canStart,
  onNewSession,
}: {
  canStart: boolean;
  onNewSession: () => void;
}) {
  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between gap-2 pr-2 pl-4"
      data-tauri-drag-region
    >
      <LogoWordmark className="pointer-events-none shrink-0" />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="New session"
              className="shrink-0 text-muted-foreground"
              disabled={!canStart}
              onClick={onNewSession}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <SquarePenIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">New session</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SidebarSearch() {
  return (
    <div className="flex shrink-0 items-center gap-1 p-2">
      <InputGroup className="border-none">
        <InputGroupInput />
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <Kbd>⌘ + K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function SidebarActions({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      <Button className="bg-input/30" onClick={onNewProject} variant="secondary">
        <FolderPlusIcon data-icon="inline-start" />
        New Project
      </Button>
    </div>
  );
}

function ProjectsBody({
  activeSessionId,
  commands,
  error,
  expanded,
  groups,
  isLoading,
  now,
  onNewSession,
  onOpenFolder,
  onRemoveSession,
  onRetry,
  onRetryScaffold,
  onSelectSession,
  onToggle,
  scaffolds,
}: {
  activeSessionId: string | null;
  commands: ProjectCommands;
  error: string | null;
  expanded: ReadonlySet<string>;
  groups: readonly PaneGroup[];
  isLoading: boolean;
  now: number;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenFolder: () => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  onRetryScaffold: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  scaffolds: ReadonlyMap<string, ScaffoldState>;
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
      <SidebarMenu>
        {PLACEHOLDERS.map((placeholder) => (
          <SidebarMenuItem key={placeholder}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
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
    <SidebarMenu>
      {groups.map((group) => (
        <ProjectGroup
          activeSessionId={activeSessionId}
          commands={commands}
          group={group}
          isExpanded={expanded.has(group.project.id)}
          key={group.project.id}
          now={now}
          onNewSession={onNewSession}
          onRemoveSession={onRemoveSession}
          onRetryScaffold={onRetryScaffold}
          onSelectSession={onSelectSession}
          onToggle={onToggle}
          scaffold={scaffolds.get(group.project.id)}
        />
      ))}
    </SidebarMenu>
  );
}
