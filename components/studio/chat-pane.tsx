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
import { useAssetOffer } from "@/hooks/use-asset-offer";
import { useEntrance } from "@/hooks/use-entrance";
import type { Environment } from "@/hooks/use-environment";
import type { Library } from "@/hooks/use-library";
import { useLocateProject } from "@/hooks/use-locate-project";
import type { NewProject } from "@/hooks/use-new-project";
import { useNow } from "@/hooks/use-now";
import type { OpenTurn } from "@/hooks/use-open-turn";
import { usePipeline } from "@/hooks/use-pipeline";
import type { StudioSettings } from "@/lib/studio/settings";
import { currentTasks } from "@/lib/studio/tasks";
import type { HistorySession, Project } from "@/shared/ipc";
import { AssetOfferCard } from "./asset-offer-card";
import { Composer } from "./composer";
import { EnvironmentChecklist } from "./environment-checklist";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { NewProjectWizard } from "./new-project-wizard";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { Startup } from "./startup";
import { StartupBackdrop } from "./startup-backdrop";
import { useStudio } from "./studio-provider";
import { TaskDock } from "./task-dock";
import { Transcript } from "./transcript";

const PLACEHOLDERS = ["one", "two", "three"];
const TICK = "1 second";

export function ChatPane() {
  const {
    activeSession,
    environment,
    isPreviewShown,
    isProjectsShown,
    library,
    newProject,
    openedProject,
    openFolder,
    relocateProject,
    settings,
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
          library={library}
          missing={openedProject?.missing ?? false}
          newProject={newProject}
          onLocate={locate}
          onOpenFolder={openFolder}
          settings={settings}
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
  library,
  missing,
  newProject,
  onLocate,
  onOpenFolder,
  settings,
  turn,
}: {
  cwd: string | null;
  environment: Environment;
  hasProject: boolean;
  library: Library;
  missing: boolean;
  newProject: NewProject;
  onLocate: () => void;
  onOpenFolder: () => void;
  settings: StudioSettings | null;
  turn: OpenTurn;
}) {
  const hasTranscript = turn.entries.length > 0 || turn.turnError !== null;
  const isCreating = newProject.isOpen;
  const isStartup = !(hasProject || hasTranscript);
  const now = useNow(turn.isRunning ? TICK : null);
  const pipeline = usePipeline(turn.openId, turn.isRunning);
  const offer = useAssetOffer({
    entries: turn.entries,
    isRunning: turn.isRunning,
    save: library.save,
  });

  return (
    // `isolate` keeps the backdrop's negative z-index inside the pane; without
    // a stacking context here it would sink behind the pane itself.
    <PaneBody className="relative isolate">
      {/* The shader is decoration on the two screens that replace the
          conversation, and nothing else, so it reads the same flags those
          screens do rather than a condition of its own that could drift into
          rendering behind a transcript. */}
      {isStartup || isCreating ? <StartupBackdrop /> : null}

      <MarkdownProvider>
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport
              aria-label={isCreating ? "New project" : "Conversation"}
            >
              <MessageScrollerContent
                className="mx-auto w-full max-w-2xl gap-3 px-4 py-6"
                data-selectable
              >
                <ConversationBody
                  cwd={cwd}
                  hasProject={hasProject}
                  hasTranscript={hasTranscript}
                  newProject={newProject}
                  now={now}
                  onOpenFolder={onOpenFolder}
                  turn={turn}
                />
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </MarkdownProvider>

      {isCreating ? null : (
        <>
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

          <AssetOfferCard offer={offer} />

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

          {/* The plan sits on top of the composer, collapsed to the task in
              hand, and opens upwards into the whole list. It reads the same
              `currentTasks` the transcript and the projects pane read, so the
              three cannot disagree about what the plan is. */}
          <TaskDock
            settings={settings}
            stages={pipeline.stages}
            tasks={currentTasks(turn.entries)}
          />

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
        </>
      )}
    </PaneBody>
  );
}

function ConversationBody({
  cwd,
  hasProject,
  hasTranscript,
  newProject,
  now,
  onOpenFolder,
  turn,
}: {
  cwd: string | null;
  hasProject: boolean;
  hasTranscript: boolean;
  newProject: NewProject;
  now: number;
  onOpenFolder: () => void;
  turn: OpenTurn;
}) {
  const entrance = useEntrance(newProject.isOpen);

  if (newProject.isOpen) {
    return <NewProjectWizard control={newProject} entrance={entrance} />;
  }

  if (hasTranscript) {
    return (
      <Transcript
        cwd={cwd}
        entries={turn.entries}
        error={turn.turnError}
        isRunning={turn.isRunning}
        isWaiting={turn.permission !== null}
        now={now}
        startedAt={turn.startedAt}
      />
    );
  }

  return (
    <ChatEmptyState
      entrance={entrance}
      hasProject={hasProject}
      onNewProject={newProject.open}
      onOpenFolder={onOpenFolder}
    />
  );
}

function ChatEmptyState({
  entrance,
  hasProject,
  onNewProject,
  onOpenFolder,
}: {
  entrance: string | null;
  hasProject: boolean;
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  if (!hasProject) {
    return (
      <Startup
        entrance={entrance}
        onNewProject={onNewProject}
        onOpenFolder={onOpenFolder}
      />
    );
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
