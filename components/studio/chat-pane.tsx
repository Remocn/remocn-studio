"use client";

import { FolderOpenIcon } from "lucide-react";
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
import { useClaudeTurn } from "@/hooks/use-claude-turn";
import { useSessionTranscript } from "@/hooks/use-session-transcript";
import type {
  EffortLevel,
  HistorySession,
  TranscriptEntry,
} from "@/shared/ipc";
import { Composer } from "./composer";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { useStudio } from "./studio-provider";
import { Transcript } from "./transcript";

const PLACEHOLDERS = ["one", "two", "three"];

export function ChatPane() {
  const {
    activeSession,
    claudeEffort,
    claudeModel,
    openedSession,
    projectFolder,
    rememberSession,
    sessionKey,
  } = useStudio();

  const history = useSessionTranscript(openedSession?.id ?? null);

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle>{titleOf(projectFolder, activeSession)}</PaneTitle>
      </PaneHeader>

      {history.isLoading ? (
        <LoadingTranscript />
      ) : (
        <Conversation
          cwd={projectFolder}
          effort={claudeEffort}
          historyId={openedSession?.id ?? null}
          initial={history.entries}
          key={sessionKey}
          model={claudeModel}
          onSession={rememberSession}
          sdkSessionId={openedSession?.sdkSessionId ?? null}
          transcriptError={history.error}
        />
      )}
    </Pane>
  );
}

function titleOf(
  projectFolder: string | null,
  session: HistorySession | null
): string {
  if (projectFolder === null) {
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
  effort,
  historyId,
  initial,
  model,
  onSession,
  sdkSessionId,
  transcriptError,
}: {
  cwd: string | null;
  effort: EffortLevel | null;
  historyId: string | null;
  initial: readonly TranscriptEntry[];
  model: string | null;
  onSession: (session: HistorySession) => void;
  sdkSessionId: string | null;
  transcriptError: string | null;
}) {
  const turn = useClaudeTurn({
    cwd,
    effort,
    historyId,
    initial,
    model,
    onSession,
    sdkSessionId,
  });

  const error = turn.error ?? transcriptError;
  const hasTranscript = turn.entries.length > 0 || error !== null;

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
                    error={error}
                    isRunning={turn.isRunning}
                    isWaiting={turn.permission !== null}
                  />
                ) : (
                  <ChatEmptyState hasProjectFolder={cwd !== null} />
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </MarkdownProvider>

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
        disabled={cwd === null}
        isRunning={turn.isRunning}
        isWaiting={turn.permission !== null}
        onStop={turn.stop}
        onSubmit={turn.send}
      />
    </PaneBody>
  );
}

function ChatEmptyState({ hasProjectFolder }: { hasProjectFolder: boolean }) {
  if (!hasProjectFolder) {
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
