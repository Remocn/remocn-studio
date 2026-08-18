"use client";

import {
  ComponentIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LibraryBigIcon,
  PanelLeftCloseIcon,
  SettingsIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
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
import { usePickAsset } from "@/hooks/use-pick-asset";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { type PaneGroup, paneSections } from "@/lib/studio/groups";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import { cn } from "@/lib/utils";
import { isMediaAsset } from "@/shared/library";
import { AssetsPane } from "./assets-pane";
import { ComponentsPane } from "./components-pane";
import { LogoWordmark } from "./logo-mark";
import { ProjectGroup } from "./project-group";
import { useStudio } from "./studio-provider";
import { UpdateStatus } from "./update-status";

const PLACEHOLDERS = ["one", "two", "three", "four"];

const VIEW_ITEMS: readonly {
  icon: typeof FolderIcon;
  label: string;
  view: PaneView;
}[] = [
  { icon: FolderIcon, label: "Projects", view: "projects" },
  { icon: LibraryBigIcon, label: "Assets", view: "assets" },
  { icon: ComponentIcon, label: "Components", view: "components" },
];

export function ProjectsPane() {
  const {
    actionError,
    activeSession,
    composer,
    drops,
    expandedProjects,
    folderError,
    groups,
    isLoadingProjects,
    library,
    newProject,
    onNewSession,
    onRemoveSession,
    onRetryScaffold,
    onSelectSession,
    onToggleProject,
    openFolder,
    paneSlide,
    paneView,
    projectsError,
    relocateProject,
    reloadProjects,
    removeProject,
    renameProject,
    scaffolds,
    sessionsError,
    showPane,
    toggleProjects,
  } = useStudio();

  const now = useNow();
  const paneError = actionError ?? folderError;
  const commands: ProjectCommands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );
  const pickable = useMemo(
    () => [...library.assets, ...library.bundled],
    [library.assets, library.bundled]
  );
  const onPickAsset = usePickAsset(pickable, composer.pick);

  const media = useMemo(
    () => library.assets.filter((asset) => isMediaAsset(asset.type)),
    [library.assets]
  );
  const components = useMemo(
    () => library.assets.filter((asset) => !isMediaAsset(asset.type)),
    [library.assets]
  );

  let content = (
    <>
      <h2 className="sr-only">Projects</h2>
      <SidebarActions
        onNewProject={newProject.open}
        onOpenFolder={openFolder}
      />
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
    </>
  );

  if (paneView === "assets") {
    content = (
      <>
        <h2 className="sr-only">Assets</h2>
        <AssetsPane
          assets={media}
          error={library.error}
          isLoading={library.isLoading}
          isOver={drops.library.isOver}
          onPick={onPickAsset}
          onRemove={library.onRemove}
          onRetry={library.reload}
        />
      </>
    );
  }

  if (paneView === "components") {
    content = (
      <>
        <h2 className="sr-only">Components</h2>
        <ComponentsPane
          assets={components}
          bundled={library.bundled}
          error={library.error}
          isLoading={library.isLoading}
          onPick={onPickAsset}
          onRemove={library.onRemove}
          onRetry={library.reload}
        />
      </>
    );
  }

  const footer = (
    <>
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
    </>
  );

  return (
    // `collapsible="none"` is what makes this a sidebar inside a resizable
    // panel rather than one fixed to the window: it drops the off-canvas gap
    // element and the mobile Sheet, and renders a plain flex column. The
    // provider is still required — every menu part reads its context.
    <SidebarProvider className="h-full min-h-0">
      {/* The shell owns the titlebar band, so the pane must not paint over
          it: the shell's background is already the sidebar colour, and the
          band fades away behind the brand row instead of being cut at the
          pane's top edge. */}
      <Sidebar
        className="w-full bg-transparent"
        collapsible="none"
        ref={drops.library.ref}
      >
        <SidebarHeader className="gap-0 p-0">
          <SidebarBrand onHide={toggleProjects} />
          <PaneViewMenu onShow={showPane} view={paneView} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup
            className={cn(
              paneSlide === "push" && "animate-screen-in",
              paneSlide === "pop" && "animate-screen-back"
            )}
            data-pane-slide
            key={paneView}
          >
            <SidebarGroupContent>{content}</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {footer}
      </Sidebar>
    </SidebarProvider>
  );
}

// The pane's views, as a vertical menu of their own: which of them is on
// screen is app state, not a row among the projects. No indicators ride on
// these items — the titlebar's mood is what says something is waiting.
function PaneViewMenu({
  onShow,
  view,
}: {
  onShow: (view: PaneView) => void;
  view: PaneView;
}) {
  const onSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isPaneView(picked)) {
        onShow(picked);
      }
    },
    [onShow]
  );

  // The active view carries a thin rail at the pane's edge and full-contrast
  // text — no filled background, so the menu reads as chrome rather than a
  // selected row. The weight never changes between states, or the labels
  // would shift as the selection moves.
  // Hover is a soft tint — the accent at 40% with full-contrast text — so
  // pointing at an item answers quietly while the rail stays the only mark
  // of the view that is actually open.
  return (
    <nav aria-label="Library views" className="px-2 py-4">
      <SidebarMenu>
        {VIEW_ITEMS.map((item) => (
          <SidebarMenuItem key={item.view}>
            <SidebarMenuButton
              className="relative pl-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground active:bg-sidebar-accent/40 active:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground"
              isActive={view === item.view}
              onClick={onSelect}
              value={item.view}
            >
              {view === item.view ? (
                <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              ) : null}
              <item.icon />
              {item.label}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}

// The traffic lights are cleared by the header's top inset, above this row, so
// the wordmark can sit on the same left edge as the group label and the project
// names below it rather than being pushed out of the column.
function SidebarBrand({ onHide }: { onHide: () => void }) {
  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between gap-2 pr-2 pl-4"
      data-tauri-drag-region
    >
      <LogoWordmark className="pointer-events-none shrink-0" />
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Hide the project list"
                className="text-muted-foreground"
                onClick={onHide}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <PanelLeftCloseIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Hide the project list</TooltipContent>
        </Tooltip>
      </div>
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
