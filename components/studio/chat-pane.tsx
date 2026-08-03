"use client";

import { PanelLeftOpenIcon, PanelRightOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Environment } from "@/hooks/use-environment";
import { useLocateProject } from "@/hooks/use-locate-project";
import { useNow } from "@/hooks/use-now";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { HistorySession, Project } from "@/shared/ipc";
import { Composer } from "./composer";
import { EnvironmentChecklist } from "./environment-checklist";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { Startup } from "./startup";
import { StartupBackdrop } from "./startup-backdrop";
import { useStudio } from "./studio-provider";
import { Transcript } from "./transcript";

const PLACEHOLDERS = ["one", "two", "three"];
const TICK = "1 second";

export function ChatPane() {
  const {
    activeSession,
    environment,
    isPreviewShown,
    isProjectsShown,
    newProject,
    openedProject,
    openFolder,
    relocateProject,
    togglePreview,
    toggleProjects,
    turn,
  } = useStudio();
  const { locate } = useLocateProject(
    openedProject?.id ?? null,
    relocateProject
  );

  return (
    <Pane>
      <PaneHeader
        className={isProjectsShown ? undefined : "pl-(--titlebar-inline-inset)"}
        data-tauri-drag-region
      >
        <div className="flex min-w-0 items-center gap-1">
          {isProjectsShown ? null : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Show the project list"
                    className="shrink-0 text-muted-foreground"
                    onClick={toggleProjects}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <PanelLeftOpenIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Show the project list
              </TooltipContent>
            </Tooltip>
          )}
          <PaneTitle>{titleOf(openedProject, activeSession)}</PaneTitle>
        </div>
        {isPreviewShown ? null : (
          <PaneActions>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Show the preview"
                    className="text-muted-foreground"
                    onClick={togglePreview}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <PanelRightOpenIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">Show the preview</TooltipContent>
            </Tooltip>
          </PaneActions>
        )}
      </PaneHeader>

      {turn.isLoadingTranscript ? (
        <LoadingTranscript />
      ) : (
        <Conversation
          cwd={openedProject?.path ?? null}
          environment={environment}
          hasProject={openedProject !== null}
          missing={openedProject?.missing ?? false}
          onLocate={locate}
          onNewProject={newProject.open}
          onOpenFolder={openFolder}
          turn={turn}
        />
      )}
    </Pane>
  );
}

function titleOf(
  project: Project | null,
  session: HistorySession | null
): string {
  if (project === null) {
    return "Chat";
  }
  return session?.title ?? "New session";
}

function LoadingTranscript() {
  return (
    <PaneBody>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
        {PLACEHOLDERS.map((placeholder) => (
          <Skeleton className="h-16 w-full rounded-xl" key={placeholder} />
        ))}
      </div>
    </PaneBody>
  );
}

function Conversation({
  cwd,
  environment,
  hasProject,
  missing,
  onLocate,
  onNewProject,
  onOpenFolder,
  turn,
}: {
  cwd: string | null;
  environment: Environment;
  hasProject: boolean;
  missing: boolean;
  onLocate: () => void;
  onNewProject: () => void;
  onOpenFolder: () => void;
  turn: OpenTurn;
}) {
  const hasTranscript = turn.entries.length > 0 || turn.turnError !== null;
  const isStartup = !(hasProject || hasTranscript);
  const now = useNow(turn.isRunning ? TICK : null);

  return (
    // `isolate` keeps the backdrop's negative z-index inside the pane; without
    // a stacking context here it would sink behind the pane itself.
    <PaneBody className="isolate">
      {/* The shader is decoration on the startup screen and nothing else, so
          it reads the same flag the screen does rather than a condition of its
          own that could drift into rendering behind a conversation. */}
      {isStartup ? <StartupBackdrop /> : null}

      <MarkdownProvider>
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent
                className="mx-auto w-full max-w-2xl gap-3 px-4 py-6"
                data-selectable
              >
                {hasTranscript ? (
                  <Transcript
                    cwd={cwd}
                    entries={turn.entries}
                    error={turn.turnError}
                    isRunning={turn.isRunning}
                    isWaiting={turn.permission !== null}
                    now={now}
                    startedAt={turn.startedAt}
                  />
                ) : (
                  <ChatEmptyState
                    hasProject={hasProject}
                    onNewProject={onNewProject}
                    onOpenFolder={onOpenFolder}
                  />
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </MarkdownProvider>

      {missing ? (
        <div className="mb-2 shrink-0 px-4 pt-1">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2">
            <p className="min-w-0 break-all text-muted-foreground text-xs">
              {cwd} is not on disk anymore.
            </p>
            <Button onClick={onLocate} size="sm" variant="outline">
              Locate…
            </Button>
          </div>
        </div>
      ) : null}

      <EnvironmentChecklist environment={environment} />

      {turn.permission === null ? null : (
        <div className="mb-2 shrink-0 px-4 pt-1">
          <div className="mx-auto w-full max-w-2xl">
            <PermissionCard
              cwd={cwd}
              key={turn.permission.id}
              onAnswer={turn.answer}
              permission={turn.permission}
            />
          </div>
        </div>
      )}

      <Composer
        context={turn.context}
        cwd={cwd}
        disabled={!hasProject || missing || environment.isBlocking}
        isRunning={turn.isRunning}
        isWaiting={turn.permission !== null}
        mode={turn.mode}
        onModeChange={turn.onModeChange}
        onStop={turn.stop}
      />
    </PaneBody>
  );
}

function ChatEmptyState({
  hasProject,
  onNewProject,
  onOpenFolder,
}: {
  hasProject: boolean;
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  if (!hasProject) {
    return <Startup onNewProject={onNewProject} onOpenFolder={onOpenFolder} />;
  }

  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia>
          <LogoMark className="size-10 text-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-2xl">What should we make?</EmptyTitle>
        {/* The panes are resizable, so this block is the app's only prose that
            reflows to arbitrary widths — `pretty` is what keeps a lone word off
            the last line as the divider moves. */}
        <EmptyDescription className="text-pretty">
          Describe the video you want and Claude builds it as real Remotion
          components in your project.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
