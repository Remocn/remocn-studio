"use client";

import {
  ArrowUpIcon,
  FolderOpenIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type ActivityState,
  type ClaudeTurn,
  type TurnEntry,
  useClaudeTurn,
} from "@/hooks/use-claude-turn";
import {
  type Composer as ComposerState,
  useComposer,
} from "@/hooks/use-composer";
import { cn } from "@/lib/utils";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";

const MODELS = [
  { label: "Default", value: "" },
  { label: "Opus 5", value: "claude-opus-5" },
  { label: "Sonnet 5", value: "claude-sonnet-5" },
  { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

const ACTIVITY_DOTS: Record<ActivityState, string> = {
  done: "bg-emerald-500",
  failed: "bg-destructive",
  running: "animate-pulse bg-amber-500",
};

export function ChatPane() {
  const { claudeModel, onModelChange, projectFolder } = useStudio();

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle>{projectFolder ? "New session" : "Chat"}</PaneTitle>
        <PaneActions>
          <NativeSelect
            aria-label="Model"
            onChange={onModelChange}
            size="sm"
            value={claudeModel ?? ""}
          >
            {MODELS.map((model) => (
              <NativeSelectOption key={model.value} value={model.value}>
                {model.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </PaneActions>
      </PaneHeader>

      <Conversation
        cwd={projectFolder}
        key={projectFolder ?? ""}
        model={claudeModel}
      />
    </Pane>
  );
}

function Conversation({
  cwd,
  model,
}: {
  cwd: string | null;
  model: string | null;
}) {
  const turn = useClaudeTurn(cwd, model);
  const composer = useComposer(turn.send);

  return (
    <PaneBody>
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto w-full max-w-2xl px-4 py-6">
              {turn.entries.length > 0 || turn.error !== null ? (
                <Transcript turn={turn} />
              ) : (
                <ChatEmptyState hasProjectFolder={cwd !== null} />
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <Composer
        composer={composer}
        disabled={cwd === null}
        isRunning={turn.isRunning}
        onStop={turn.stop}
      />
    </PaneBody>
  );
}

function Transcript({ turn }: { turn: ClaudeTurn }) {
  return (
    <div className="flex flex-col gap-4">
      {turn.entries.map((entry) => (
        <Entry entry={entry} key={entry.id} />
      ))}

      {turn.error ? (
        <p
          className="rounded-xl bg-destructive/10 px-3 py-2 text-destructive text-sm"
          role="alert"
        >
          {turn.error}
        </p>
      ) : null}
    </div>
  );
}

function Entry({ entry }: { entry: TurnEntry }) {
  if (entry.kind === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end">
            <BubbleContent>{entry.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <Message>
        <MessageContent>
          <Bubble variant="ghost">
            <BubbleContent className="whitespace-pre-wrap">
              {entry.text}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  if (entry.kind === "notice") {
    return <p className="text-muted-foreground text-xs">{entry.text}</p>;
  }

  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          ACTIVITY_DOTS[entry.state]
        )}
      />
      <span className="truncate text-muted-foreground">{entry.name}</span>
    </div>
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
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>No session selected</EmptyTitle>
        <EmptyDescription>
          Describe the video you want and Claude builds it as real Remotion
          components in your project.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function Composer({
  composer,
  disabled,
  isRunning,
  onStop,
}: {
  composer: ComposerState;
  disabled: boolean;
  isRunning: boolean;
  onStop: () => void;
}) {
  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="mx-auto w-full max-w-2xl">
        <InputGroup>
          <InputGroupTextarea
            aria-label="Message Claude"
            disabled={disabled}
            onChange={composer.onChange}
            onKeyDown={composer.onKeyDown}
            placeholder="Describe the scene you want to build…"
            rows={2}
            value={composer.value}
          />
          <InputGroupAddon align="block-end" className="justify-end">
            {isRunning ? (
              <InputGroupButton
                onClick={onStop}
                size="icon-sm"
                variant="outline"
              >
                <SquareIcon />
                <span className="sr-only">Stop</span>
              </InputGroupButton>
            ) : (
              <InputGroupButton
                disabled={disabled || composer.value.trim().length === 0}
                onClick={composer.submit}
                size="icon-sm"
                variant="default"
              >
                <ArrowUpIcon />
                <span className="sr-only">Send</span>
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
