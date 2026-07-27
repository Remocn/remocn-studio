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
import { useLocateProject } from "@/hooks/use-locate-project";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { HistorySession, Project } from "@/shared/ipc";
import { Composer } from "./composer";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { useStudio } from "./studio-provider";
import { Transcript } from "./transcript";

const PLACEHOLDERS = ["one", "two", "three"];

export function ChatPane() {
  const { activeSession, openedProject, relocateProject, turn } = useStudio();
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
  hasProject,
  missing,
  onLocate,
  turn,
}: {
  cwd: string | null;
  hasProject: boolean;
  missing: boolean;
  onLocate: () => void;
  turn: OpenTurn;
}) {
  const hasTranscript = turn.entries.length > 0 || turn.turnError !== null;

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

      {turn.permission === null ? null : (
        <div className="mb-2 shrink-0 px-4 pt-1">
          <div className="mx-auto w-full max-w-2xl">
            <PermissionCard
              cwd={cwd}
              onAnswer={turn.answer}
              permission={turn.permission}
            />
          </div>
        </div>
      )}

      <Composer
        context={turn.context}
        disabled={!hasProject || missing}
        isRunning={turn.isRunning}
        isWaiting={turn.permission !== null}
        mode={turn.mode}
        onModeChange={turn.onModeChange}
        onStop={turn.stop}
        onSubmit={turn.send}
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
          <EmptyDescription>
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
        <EmptyDescription>
          Describe the video you want and Claude builds it as real Remotion
          components in your project.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
