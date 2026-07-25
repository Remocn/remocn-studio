"use client";

import { ChevronRightIcon, SquarePenIcon, UnplugIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import { useVisibleSessions } from "@/hooks/use-visible-sessions";
import { statusOf, type TurnState } from "@/lib/studio/turns";
import { cn } from "@/lib/utils";
import type { HistorySession, Project } from "@/shared/ipc";
import { ProjectMenu } from "./project-menu";
import { SessionItem } from "./session-item";

export function ProjectGroup({
  activeSessionId,
  commands,
  isExpanded,
  onNewSession,
  onRemoveSession,
  onSelectSession,
  onToggle,
  project,
  sessions,
  turns,
}: {
  activeSessionId: string | null;
  commands: ProjectCommands;
  isExpanded: boolean;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  project: Project;
  sessions: readonly HistorySession[];
  turns: ReadonlyMap<string, TurnState>;
}) {
  const { hidden, showAll, visible } = useVisibleSessions(sessions);
  const panelId = `project-${project.id}`;

  return (
    <div className="flex flex-col">
      <div className="group/project relative">
        <Button
          aria-controls={panelId}
          aria-expanded={isExpanded}
          className={cn(
            "w-full justify-start gap-1.5 pr-14 pl-1.5 font-medium text-sidebar-foreground text-xs",
            project.missing && "opacity-50"
          )}
          onClick={onToggle}
          size="sm"
          value={project.id}
          variant="ghost"
        >
          <ChevronRightIcon
            className={cn(
              "shrink-0 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
          <span className="truncate">{project.name}</span>
          {project.missing ? (
            <Tooltip>
              <TooltipTrigger render={<span className="shrink-0" />}>
                <UnplugIcon className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="break-all">
                  {project.path} is not on disk anymore
                </span>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </Button>

        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center opacity-0 focus-within:opacity-100 group-hover/project:opacity-100">
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
      </div>

      {isExpanded ? (
        <ol className="flex flex-col gap-0.5 pl-3" id={panelId}>
          {visible.map((session) => (
            <li key={session.id}>
              <SessionItem
                isActive={session.id === activeSessionId}
                onRemove={onRemoveSession}
                onSelect={onSelectSession}
                session={session}
                status={statusOf(turns.get(session.id))}
                unread={turns.get(session.id)?.unread ?? false}
              />
            </li>
          ))}

          {sessions.length === 0 ? (
            <li className="px-3 py-1.5 text-muted-foreground text-xs">
              No sessions yet
            </li>
          ) : null}

          {hidden > 0 ? (
            <li>
              <Button
                className="w-full justify-start pl-3 text-muted-foreground text-xs"
                onClick={showAll}
                size="sm"
                variant="ghost"
              >
                Show {hidden} more
              </Button>
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}
