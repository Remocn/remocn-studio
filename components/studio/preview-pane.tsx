"use client";

import { FolderOpenIcon, MonitorPlayIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";

export function PreviewPane() {
  const { projectFolder } = useStudio();

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle>Preview</PaneTitle>
      </PaneHeader>

      <PaneBody className="p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div className="aspect-(--preview-aspect) w-full max-w-[calc(100cqh*var(--preview-w)/var(--preview-h))] overflow-hidden rounded-xl border bg-black/30 [--preview-aspect:calc(var(--preview-w)/var(--preview-h))] [--preview-h:9] [--preview-w:16]">
            {projectFolder ? (
              <Empty className="h-full p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MonitorPlayIcon />
                  </EmptyMedia>
                  <EmptyTitle>Preview not running</EmptyTitle>
                  <EmptyDescription>
                    The player starts once there is something to play.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="h-full p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpenIcon />
                  </EmptyMedia>
                  <EmptyTitle>No folder open</EmptyTitle>
                  <EmptyDescription>
                    The preview mirrors the project on disk.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
      </PaneBody>
    </Pane>
  );
}
