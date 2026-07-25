"use client";

import {
  FolderOpenIcon,
  MessagesSquareIcon,
  SquarePenIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";

export function SessionsPane() {
  const { openFolder, projectFolder } = useStudio();

  return (
    <Pane className="bg-sidebar">
      <PaneHeader>
        <PaneTitle>Sessions</PaneTitle>
        <PaneActions>
          <Button disabled size="icon-sm" variant="ghost">
            <SquarePenIcon />
            <span className="sr-only">New session</span>
          </Button>
        </PaneActions>
      </PaneHeader>

      <PaneBody>
        {projectFolder ? (
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
        ) : (
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
            <Button onClick={openFolder} size="sm" variant="outline">
              <FolderOpenIcon data-icon="inline-start" />
              Open folder
            </Button>
          </Empty>
        )}
      </PaneBody>
    </Pane>
  );
}
