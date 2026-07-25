"use client";

import { FolderOpenIcon, MonitorPlayIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { type Preview, usePreview } from "@/hooks/use-preview";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";

export function PreviewPane() {
  const { projectFolder } = useStudio();
  const { hint, preview, restart } = usePreview(projectFolder);

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle>Preview</PaneTitle>
        {preview.phase === "failed" ? (
          <PaneActions>
            <Button onClick={restart} size="sm" variant="ghost">
              <RotateCwIcon />
              Restart
            </Button>
          </PaneActions>
        ) : null}
      </PaneHeader>

      <PaneBody className="gap-2 p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div className="aspect-(--preview-aspect) w-full max-w-[calc(100cqh*var(--preview-w)/var(--preview-h))] overflow-hidden rounded-xl border bg-black/30 [--preview-aspect:calc(var(--preview-w)/var(--preview-h))] [--preview-h:9] [--preview-w:16]">
            {projectFolder === null ? (
              <NoFolder />
            ) : (
              <Stage preview={preview} />
            )}
          </div>
        </div>

        {hint === null ? null : (
          <p className="shrink-0 text-center text-muted-foreground text-xs">
            {hint}
          </p>
        )}
      </PaneBody>
    </Pane>
  );
}

function Stage({ preview }: { readonly preview: Preview }) {
  if (preview.phase === "ready") {
    return (
      <iframe
        allow="autoplay; fullscreen"
        className="h-full w-full border-0"
        src={preview.url}
        title="Remotion preview"
      />
    );
  }

  if (preview.phase === "failed") {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="whitespace-pre-wrap font-mono text-destructive text-xs leading-relaxed">
          {preview.message}
        </pre>
      </div>
    );
  }

  if (preview.phase === "building") {
    return (
      <Empty className="h-full p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Building the project</EmptyTitle>
          <EmptyDescription>
            {preview.percent > 0
              ? `Compiling — ${preview.percent}%`
              : "Starting the compiler."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
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
  );
}

function NoFolder() {
  return (
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
  );
}
