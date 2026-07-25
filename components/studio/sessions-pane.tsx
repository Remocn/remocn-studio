"use client";

import {
  FolderOpenIcon,
  MessagesSquareIcon,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HistorySession } from "@/shared/ipc";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { SessionItem } from "./session-item";
import { useStudio } from "./studio-provider";

const PLACEHOLDERS = ["one", "two", "three", "four"];

export function SessionsPane() {
  const {
    activeSession,
    isLoadingSessions,
    isThinking,
    onRemoveSession,
    onSelectSession,
    openFolder,
    projectFolder,
    reloadSessions,
    sessions,
    sessionsError,
    startSession,
  } = useStudio();

  return (
    <Pane className="bg-sidebar">
      <PaneHeader>
        <PaneTitle>Sessions</PaneTitle>
        <PaneActions>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  disabled={projectFolder === null}
                  onClick={startSession}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <SquarePenIcon />
              <span className="sr-only">New session</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">New session</TooltipContent>
          </Tooltip>
        </PaneActions>
      </PaneHeader>

      <PaneBody>
        <SessionsBody
          activeId={activeSession?.id ?? null}
          error={sessionsError}
          isLoading={isLoadingSessions}
          isThinking={isThinking}
          onOpenFolder={openFolder}
          onRemove={onRemoveSession}
          onRetry={reloadSessions}
          onSelect={onSelectSession}
          projectFolder={projectFolder}
          sessions={sessions}
        />
      </PaneBody>
    </Pane>
  );
}

function SessionsBody({
  activeId,
  error,
  isLoading,
  isThinking,
  onOpenFolder,
  onRemove,
  onRetry,
  onSelect,
  projectFolder,
  sessions,
}: {
  activeId: string | null;
  error: string | null;
  isLoading: boolean;
  isThinking: boolean;
  onOpenFolder: () => Promise<void>;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  projectFolder: string | null;
  sessions: readonly HistorySession[];
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
          <Skeleton className="h-11 w-full rounded-lg" key={placeholder} />
        ))}
      </div>
    );
  }

  if (sessions.length > 0) {
    const now = Date.now();

    return (
      <ol className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <SessionItem
              isActive={session.id === activeId}
              isThinking={isThinking && session.id === activeId}
              now={now}
              onRemove={onRemove}
              onSelect={onSelect}
              session={session}
            />
          </li>
        ))}
      </ol>
    );
  }

  if (projectFolder === null) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No folder open</EmptyTitle>
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
    <Empty className="px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessagesSquareIcon />
        </EmptyMedia>
        <EmptyTitle>No sessions yet</EmptyTitle>
        <EmptyDescription>
          Every conversation with Claude is kept here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
