"use client";

import {
  ChevronDown,
  ChevronRight,
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  SquarePenIcon,
  UnplugIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { useVisibleSessions } from "@/hooks/use-visible-sessions";
import type { Rollup as GroupRollup, PaneGroup } from "@/lib/studio/groups";
import { cn } from "@/lib/utils";
import { ProjectMenu } from "./project-menu";
import { SessionItem } from "./session-item";

function ProjectGroupBlock({
  activeSessionId,
  commands,
  group,
  isExpanded,
  now,
  onNewSession,
  onRemoveSession,
  onRetryScaffold,
  onSelectSession,
  onToggle,
  scaffold,
}: {
  activeSessionId: string | null;
  commands: ProjectCommands;
  group: PaneGroup;
  isExpanded: boolean;
  now: number;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetryScaffold: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  scaffold: ScaffoldState | undefined;
}) {
  const { hidden, isFull, toggle, visible } = useVisibleSessions(group);
  const { project } = group;
  const panelId = `project-${project.id}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-controls={panelId}
        aria-expanded={isExpanded}
        className="pr-14 font-medium hover:bg-sidebar-accent/40 active:bg-sidebar-accent/40"
        onClick={onToggle}
        value={project.id}
      >
        {isExpanded ? (
          <ChevronDown className="text-muted-foreground" />
        ) : (
          <ChevronRight className="text-muted-foreground" />
        )}
        {/* Only the name dims for a missing project: the chevron and the menu
            are still the way to its history and to Locate…, so they keep full
            contrast. */}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            project.missing && "text-sidebar-foreground/70"
          )}
        >
          {project.name}
        </span>
        {project.missing ? (
          <Tooltip>
            <TooltipTrigger render={<span className="shrink-0" />}>
              <UnplugIcon className="size-3 text-muted-foreground" />
              <span className="sr-only">
                {project.path} is not on disk anymore
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="break-all">
                {project.path} is not on disk anymore
              </span>
            </TooltipContent>
          </Tooltip>
        ) : null}
        {isExpanded ? null : <Rollup rollup={group.rollup} />}
      </SidebarMenuButton>

      {/* `has-[[data-popup-open]]` keeps the cluster visible while its menu is
          open: the popup is portalled, so hover and focus-within both read
          false the moment it opens. */}
      <div className="absolute top-1 right-1 flex items-center opacity-0 focus-within:opacity-100 group-hover/menu-item:opacity-100 has-[[data-popup-open]]:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`New session in ${project.name}`}
                disabled={project.missing}
                onClick={onNewSession}
                size="icon-xs"
                value={project.id}
                variant="ghost"
              />
            }
          >
            <SquarePenIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">New session here</TooltipContent>
        </Tooltip>

        <ProjectMenu commands={commands} project={project} />
      </div>

      {scaffold === undefined ? null : (
        <Scaffolding
          onRetry={onRetryScaffold}
          projectId={project.id}
          scaffold={scaffold}
        />
      )}

      {isExpanded ? (
        // The sub-list keeps its semantics but drops its rail and indent: a
        // session title lines up with the project name above it, one level.
        // `role="list"` survives preflight's list-style:none, which WKWebView
        // otherwise takes as a reason to drop list semantics entirely.
        <SidebarMenuSub
          className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0"
          id={panelId}
          role="list"
        >
          {visible.map((row) => (
            <SidebarMenuSubItem key={row.session.id}>
              <SessionItem
                isActive={row.session.id === activeSessionId}
                now={now}
                onRemove={onRemoveSession}
                onSelect={onSelectSession}
                row={row}
              />
            </SidebarMenuSubItem>
          ))}

          {group.rows.length === 0 ? (
            <SidebarMenuSubItem className="py-1.5 pr-2 pl-7 text-muted-foreground text-xs">
              No sessions yet
            </SidebarMenuSubItem>
          ) : null}

          {hidden > 0 || isFull ? (
            <SidebarMenuSubItem>
              <Button
                className="h-7 w-full justify-start pl-7 text-muted-foreground text-xs hover:bg-transparent hover:text-foreground"
                onClick={toggle}
                size="sm"
                variant="ghost"
              >
                {hidden > 0 ? `Show ${hidden} more` : "Show less"}
              </Button>
            </SidebarMenuSubItem>
          ) : null}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

export const ProjectGroup = memo(ProjectGroupBlock);

const ROLLUP_WORD: Record<GroupRollup["status"], string> = {
  failed: "failed",
  running: "running",
  unread: "unread",
  waiting: "waiting",
};

function Rollup({ rollup }: { rollup: GroupRollup | null }) {
  if (rollup === null) {
    return null;
  }

  const { count, status } = rollup;
  const label = `${count} ${count === 1 ? "session" : "sessions"} ${ROLLUP_WORD[status]}`;

  return (
    <span
      aria-label={label}
      className="flex shrink-0 items-center gap-1 font-normal text-[0.6875rem] text-muted-foreground tabular-nums"
      role="img"
    >
      {status === "waiting" ? (
        <>
          <CircleQuestionMarkIcon className="size-4 shrink-0 text-sidebar-primary" />
          <span aria-hidden="true">{count}</span>
        </>
      ) : null}
      {status === "running" ? (
        <DotmSquare1
          ariaLabel=""
          className="shrink-0 text-sidebar-primary"
          dotSize={2}
          size={16}
        />
      ) : null}
      {status === "failed" ? (
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
      ) : null}
      {status === "unread" ? (
        <span className="size-1.5 rounded-full bg-sidebar-primary" />
      ) : null}
    </span>
  );
}

const DOING: Record<ScaffoldState["step"], string> = {
  install: "Installing dependencies…",
  template: "Copying the template…",
};

const FAILED: Record<ScaffoldState["step"], string> = {
  install: "Could not install the dependencies.",
  template: "Could not copy the template.",
};

function Scaffolding({
  onRetry,
  projectId,
  scaffold,
}: {
  onRetry: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState;
}) {
  if (scaffold.isRunning) {
    return (
      <p className="flex items-center gap-2 py-1 pl-7 text-muted-foreground text-xs">
        <Spinner className="size-3" />
        {DOING[scaffold.step]}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1 pl-7">
      <p className="text-destructive text-xs">{FAILED[scaffold.step]}</p>
      {scaffold.error === null ? null : (
        <p className="line-clamp-3 break-all font-mono text-[0.6875rem] text-muted-foreground">
          {scaffold.error}
        </p>
      )}
      <Button
        className="self-start text-xs"
        onClick={onRetry}
        size="sm"
        value={projectId}
        variant="outline"
      >
        Retry
      </Button>
    </div>
  );
}
