"use client";

import { ArrowUpIcon, FolderOpenIcon, SparklesIcon } from "lucide-react";
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
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";

export function ChatPane() {
  const { projectFolder } = useStudio();

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle>{projectFolder ? "New session" : "Chat"}</PaneTitle>
      </PaneHeader>

      <PaneBody>
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent className="mx-auto w-full max-w-2xl px-4 py-6">
                <ChatEmptyState hasProjectFolder={projectFolder !== null} />
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        <Composer disabled />
      </PaneBody>
    </Pane>
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

function Composer({ disabled }: { disabled: boolean }) {
  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="mx-auto w-full max-w-2xl">
        <InputGroup>
          <InputGroupTextarea
            aria-label="Message Claude"
            disabled={disabled}
            placeholder="Describe the scene you want to build…"
            rows={2}
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton
              disabled={disabled}
              size="icon-sm"
              variant="default"
            >
              <ArrowUpIcon />
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
