"use client";

import {
  FolderOpenIcon,
  FolderPlusIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { useNow } from "@/hooks/use-now";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { type PaneGroup, paneSections } from "@/lib/studio/groups";
import { LogoWordmark } from "./logo-mark";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectGroup } from "./project-group";
import { useStudio } from "./studio-provider";
import { UpdateStatus } from "./update-status";

const PLACEHOLDERS = ["one", "two", "three", "four"];

export function ProjectsPane() {
  const {
    actionError,
    activeProject,
    activeSession,
    expandedProjects,
    folderError,
    groups,
    isLoadingProjects,
    newProject,
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
  const paneError = actionError ?? folderError;
  const commands: ProjectCommands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );

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
          <SidebarActions
            onNewProject={newProject.open}
            onOpenFolder={openFolder}
          />
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
              <UpdateStatus />
            </SidebarMenuItem>
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

function SidebarActions({
  onNewProject,
  onOpenFolder,
}: {
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      <Button
        className="flex-1 bg-input/30"
        onClick={onNewProject}
        variant="secondary"
      >
        <FolderPlusIcon data-icon="inline-start" />
        New Project
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Open an existing project"
              className="shrink-0 text-muted-foreground"
              onClick={onOpenFolder}
              size="icon"
              variant="ghost"
            />
          }
        >
          <FolderOpenIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">Open an existing project</TooltipContent>
      </Tooltip>
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

  const { active, gone } = paneSections(groups);

  const item = (group: PaneGroup) => (
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
  );

  return (
    <>
      {active.length === 0 ? null : (
        <SidebarMenu>{active.map(item)}</SidebarMenu>
      )}

      {gone.length === 0 ? null : (
        <>
          <h3
            className="mt-2 flex h-8 shrink-0 items-center px-2 font-medium text-sidebar-foreground/70 text-xs"
            title="These folders are not where the studio left them. Locate… reconnects one that moved."
          >
            Moved or deleted
          </h3>
          <SidebarMenu>{gone.map(item)}</SidebarMenu>
        </>
      )}
    </>
  );
}
