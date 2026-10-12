"use client";

import dynamic from "next/dynamic";
import {
  ArrowLeftIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  RotateCwIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePresence } from "@/hooks/use-presence";
import type { Snapshot } from "@/hooks/use-snapshot";
import type { Tools } from "@/hooks/use-tools";
import { exportLabel } from "@/lib/studio/export";
import { fileManagerName } from "@/lib/studio/platform";
import { cn } from "@/lib/utils";
import type { Exported } from "@/shared/ipc";
import { DocsView } from "./docs-view";
import { ExportButton } from "./export-button";
import { FailureText } from "./failure-text";
import { Pane, PaneActions, PaneHeader } from "./pane";
import { useStudio } from "./studio-provider";

const ROW =
  "shrink-0 animate-fade-in transition-opacity duration-fast ease-out data-leaving:opacity-0";

const CanvasPreview = dynamic(() =>
  import("./canvas-preview").then((module) => module.CanvasPreview)
);

export function PreviewPane() {
  const { activeProject, docs, isChatPeeking, isChatShown, toggleChat, tools } =
    useStudio();
  const isDocs = docs.mode === "docs";

  const leading = isChatShown ? null : (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-expanded={isChatPeeking}
            aria-label="Show the chat"
            className="shrink-0 text-muted-foreground"
            onClick={toggleChat}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MessageSquareIcon />
      </TooltipTrigger>
      <TooltipContent side="bottom">Show the chat</TooltipContent>
    </Tooltip>
  );

  const actions = (
    <PaneActions className="ms-auto">
      <ExportButton
        composition={tools.preview.composition}
        exporting={tools.exporting}
      />
    </PaneActions>
  );

  return (
    <Pane>
      {isDocs ? (
        <PaneHeader data-tauri-drag-region="deep">
          {leading}
          <Button
            className="text-muted-foreground"
            onClick={docs.onPickMode}
            size="sm"
            value="preview"
            variant="ghost"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Preview
          </Button>
          {actions}
        </PaneHeader>
      ) : null}

      {isDocs ? <DocsView docs={docs} /> : null}

      {/* The preview is hidden, never unmounted: taking the runtime down would
          cost a rebuild and the frame the person was looking at every time
          they read a document. */}
      <CanvasPreview
        actions={isDocs ? null : actions}
        hidden={isDocs}
        leading={isDocs ? null : leading}
        status={
          <StatusSlot
            projectPath={activeProject?.path ?? null}
            snapshot={tools.snapshot}
            tools={tools}
          />
        }
      />
    </Pane>
  );
}

/**
 * The frame's width derives from the container's height, so a status row
 * appearing in the flow would rescale the video. This slot keeps one row's
 * height reserved whether or not anything is being said.
 */
function StatusSlot({
  projectPath,
  snapshot,
  tools,
}: {
  projectPath: string | null;
  snapshot: Snapshot;
  tools: Tools;
}) {
  const { exporting, inspect } = tools;
  const { hint } = tools.preview;
  const trouble = usePresence(inspect.trouble ?? snapshot.trouble);
  const status = usePresence(snapshot.status);
  const result = usePresence(exporting.result);
  const failed = usePresence(exporting.trouble);
  const quiet =
    trouble.shown === null &&
    status.shown === null &&
    result.shown === null &&
    failed.shown === null &&
    exporting.notices.length === 0 &&
    hint === null;

  return (
    <div className="flex min-h-8 shrink-0 flex-col justify-center gap-2">
      {trouble.shown === null ? null : (
        /* A percent-encoded URL is one unbreakable word, and this block used
           to carry them: the text ran past the pane's right edge and off the
           window, clipped mid-token with no wrap and no scroll.
           `renderFailure` words those away, and this is the insurance for
           whatever a renderer says next. */
        <div
          className={cn(ROW, "max-h-32 overflow-auto")}
          data-leaving={trouble.isLeaving ? "" : undefined}
        >
          <FailureText
            align="center"
            className="text-center text-destructive text-xs [overflow-wrap:anywhere]"
            fallback="The preview could not do that."
            role="alert"
            text={trouble.shown}
          />
        </div>
      )}

      {status.shown === null ? null : (
        <p
          className={cn(ROW, "text-center text-muted-foreground text-xs")}
          data-leaving={status.isLeaving ? "" : undefined}
          role="status"
        >
          {status.shown}
        </p>
      )}

      {result.shown === null ? null : (
        <ExportedRow
          exported={result.shown}
          exporting={exporting}
          isLeaving={result.isLeaving}
          projectPath={projectPath}
        />
      )}

      {exporting.notices.map((notice) => (
        <p
          className="shrink-0 text-center text-muted-foreground text-xs [overflow-wrap:anywhere]"
          key={notice}
          role="status"
        >
          {notice}
        </p>
      ))}

      {failed.shown === null ? null : (
        <ExportFailedRow
          exporting={exporting}
          isLeaving={failed.isLeaving}
          message={failed.shown}
        />
      )}

      {hint === null ? null : <LineHint text={hint} />}

      {quiet && tools.preview.isServing && !snapshot.isArmed ? (
        <QuietHint
          editingText={tools.managed?.editingText === true}
          selecting={inspect.card !== null || tools.managed?.isOpen === true}
          unavailable={inspect.unavailable}
        />
      ) : null}
    </div>
  );
}

function ExportedRow({
  exported,
  exporting,
  isLeaving,
  projectPath,
}: {
  exported: Exported;
  exporting: Tools["exporting"];
  isLeaving: boolean;
  projectPath: string | null;
}) {
  return (
    <div
      className={cn(ROW, "flex items-center justify-center gap-2 text-xs")}
      data-leaving={isLeaving ? "" : undefined}
      role="status"
    >
      <span className="text-muted-foreground">Exported</span>
      <span className="min-w-0 truncate font-mono">
        {exportLabel(exported, projectPath)}
      </span>
      <Button onClick={exporting.reveal} size="xs" variant="ghost">
        <FolderOpenIcon data-icon="inline-start" />
        Show in {fileManagerName()}
      </Button>
      <Button
        aria-label="Dismiss"
        className="text-muted-foreground"
        onClick={exporting.dismiss}
        size="icon-xs"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </div>
  );
}

function ExportFailedRow({
  exporting,
  isLeaving,
  message,
}: {
  exporting: Tools["exporting"];
  isLeaving: boolean;
  message: string;
}) {
  return (
    <div
      className={cn(ROW, "flex flex-col items-center gap-1.5")}
      data-leaving={isLeaving ? "" : undefined}
    >
      <div className="max-h-32 w-full overflow-auto">
        <FailureText
          align="center"
          className="text-center text-destructive text-xs [overflow-wrap:anywhere]"
          fallback="The export stopped because something went wrong."
          role="alert"
          text={message}
        />
      </div>
      <div className="flex items-center gap-1">
        {exporting.canRetry ? (
          <Button onClick={exporting.retry} size="xs" variant="outline">
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        ) : null}
        <Button onClick={exporting.dismiss} size="xs" variant="ghost">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function LineHint({ text }: { text: string }) {
  return (
    <p
      className="shrink-0 truncate text-center text-muted-foreground text-xs"
      title={text}
    >
      {text}
    </p>
  );
}

function QuietHint({
  editingText,
  selecting,
  unavailable,
}: {
  editingText: boolean;
  selecting: boolean;
  unavailable: string | null;
}) {
  if (unavailable !== null) {
    return <LineHint text={unavailable} />;
  }

  return (
    <p className="flex h-4 flex-wrap justify-center overflow-hidden text-muted-foreground text-xs">
      <span aria-hidden="true" className="h-4 w-0" />
      <span className="whitespace-nowrap">
        {canvasHint(editingText, selecting)}
      </span>
    </p>
  );
}

function canvasHint(editingText: boolean, selecting: boolean) {
  if (editingText) {
    return "Click outside to save · Esc to cancel";
  }
  if (selecting) {
    return "Double-click text to edit · Esc to clear selection";
  }
  return "Click to select · Double-click text to edit";
}
