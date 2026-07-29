"use client";

import {
  DownloadIcon,
  FolderOpenIcon,
  MonitorPlayIcon,
  RotateCwIcon,
  SquareDashedMousePointerIcon,
} from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { Preview } from "@/hooks/use-preview";
import { InspectOverlay } from "./inspect-overlay";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { SidecarStatus } from "./sidecar-status";
import { useStudio } from "./studio-provider";

export function PreviewPane() {
  const { activeProject, inspect, openedProject } = useStudio();
  const { hint, preview, restart, stage } = inspect.preview;

  return (
    <Pane>
      <PaneHeader data-tauri-drag-region>
        <PaneTitle>Preview</PaneTitle>
        <PaneActions>
          {preview.phase === "failed" ? (
            <Button onClick={restart} size="sm" variant="ghost">
              <RotateCwIcon />
              Restart
            </Button>
          ) : null}
          <Button
            aria-pressed={inspect.isArmed}
            disabled={!inspect.canInspect}
            onClick={inspect.toggle}
            size="sm"
            title={inspect.unavailable ?? "Pick an element to comment on"}
            variant={inspect.isArmed ? "default" : "ghost"}
          >
            <SquareDashedMousePointerIcon data-icon="inline-start" />
            Inspect
          </Button>
          <SidecarStatus />
          <Button size="sm">
            <DownloadIcon data-icon="inline-start" />
            Export
          </Button>
        </PaneActions>
      </PaneHeader>

      <PaneBody className="gap-2 p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div className="relative aspect-(--preview-aspect) w-full max-w-[calc(100cqh*var(--preview-w)/var(--preview-h))] overflow-hidden rounded-xl border bg-black/30 [--preview-aspect:calc(var(--preview-w)/var(--preview-h))] [--preview-h:9] [--preview-w:16]">
            {activeProject === null ? (
              <NoFolder />
            ) : (
              <Stage preview={preview} stage={stage} />
            )}

            {inspect.isArmed ? (
              <InspectOverlay
                card={inspect.card}
                cwd={openedProject?.path ?? null}
                markers={inspect.markers}
                onCancel={inspect.cancelComment}
                onSubmit={inspect.submitComment}
              />
            ) : null}
          </div>
        </div>

        {inspect.trouble === null ? null : (
          <p
            className="shrink-0 text-center text-destructive text-xs"
            role="alert"
          >
            {inspect.trouble}
          </p>
        )}

        {hint === null ? null : (
          <p className="shrink-0 text-center text-muted-foreground text-xs">
            {hint}
          </p>
        )}
      </PaneBody>
    </Pane>
  );
}

function Stage({
  preview,
  stage,
}: {
  readonly preview: Preview;
  readonly stage: RefObject<HTMLIFrameElement | null>;
}) {
  if (preview.phase === "ready") {
    return (
      <iframe
        allow="autoplay; fullscreen"
        className="h-full w-full border-0"
        ref={stage}
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
