"use client";

import { FolderOpenIcon } from "lucide-react";
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
import type { Environment } from "@/hooks/use-environment";
import { useLocateProject } from "@/hooks/use-locate-project";
import { useNow } from "@/hooks/use-now";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { HistorySession, Project } from "@/shared/ipc";
import { Composer } from "./composer";
import { EnvironmentChecklist } from "./environment-checklist";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { useStudio } from "./studio-provider";
import { Transcript } from "./transcript";

const PLACEHOLDERS = ["one", "two", "three"];
const TICK = "1 second";

export function ChatPane() {
  const { activeSession, environment, openedProject, relocateProject, turn } =
    useStudio();
  const { locate } = useLocateProject(
    openedProject?.id ?? null,
    relocateProject
  );

  return (
    <Pane>
      <PaneHeader data-tauri-drag-region>
        <PaneTitle>{titleOf(openedProject, activeSession)}</PaneTitle>
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
  turn,
}: {
  cwd: string | null;
  environment: Environment;
  hasProject: boolean;
  missing: boolean;
  onLocate: () => void;
  turn: OpenTurn;
}) {
  const hasTranscript = turn.entries.length > 0 || turn.turnError !== null;
  const now = useNow(turn.isRunning ? TICK : null);

  return (
    <PaneBody>
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
                  <ChatEmptyState hasProject={hasProject} />
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

function ChatEmptyState({ hasProject }: { hasProject: boolean }) {
  if (!hasProject) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No folder open</EmptyTitle>
          {/* The panes are resizable, so these two blocks are the app's only
              prose that reflows to arbitrary widths — `pretty` is what keeps a
              lone word off the last line as the divider moves. */}
          <EmptyDescription className="text-pretty">
            Claude works inside one Remotion project at a time. Open a folder to
            give it somewhere to write.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia>
          <LogoMark className="size-10 text-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-2xl">What should we make?</EmptyTitle>
        <EmptyDescription className="text-pretty">
          Describe the video you want and Claude builds it as real Remotion
          components in your project.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
