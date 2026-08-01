"use client";

import {
  useTruncatedLines,
  useTruncatedText,
} from "@/hooks/use-truncated-lines";
import type { ToolDetail } from "@/lib/studio/activity";
import type { DiffLine, DiffLineKind } from "@/lib/studio/diff";
import { cn } from "@/lib/utils";

const DIFF_STYLES: Record<DiffLineKind, string> = {
  added: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  context: "text-muted-foreground",
  removed: "bg-destructive/10 text-destructive",
};

const DIFF_MARKS: Record<DiffLineKind, string> = {
  added: "+",
  context: " ",
  removed: "-",
};

export function ActivityDetail({ detail }: { detail: ToolDetail }) {
  if (detail.kind === "diff") {
    return <DiffLines lines={detail.lines} />;
  }

  if (detail.kind === "command") {
    return <CommandOutput command={detail.command} output={detail.output} />;
  }

  return <OutputText text={detail.text} />;
}

// The three scroll containers below carry `role="region"` + `tabIndex={0}`:
// axe's scrollable-region-focusable rule requires exactly this, or a wide diff
// and long command output cannot be scrolled from the keyboard at all.
// biome-ignore-start lint/a11y/useSemanticElements: a labelled region is the ARIA pattern for a focusable scroll container
// biome-ignore-start lint/a11y/noNoninteractiveTabindex: axe's scrollable-region-focusable requires it

function DiffLines({ lines }: { lines: DiffLine[] }) {
  const visible = useTruncatedLines(lines);

  return (
    <Frame>
      <div
        aria-label="Diff"
        className="overflow-x-auto py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        role="region"
        tabIndex={0}
      >
        {visible.shown.map((line) => (
          <div
            className={cn("whitespace-pre px-2", DIFF_STYLES[line.kind])}
            key={line.id}
          >
            {`${DIFF_MARKS[line.kind]}${line.text}`}
          </div>
        ))}
      </div>
      <MoreLines hidden={visible.hidden} onExpand={visible.expand} />
    </Frame>
  );
}

function CommandOutput({
  command,
  output,
}: {
  command: string;
  output: string;
}) {
  const visible = useTruncatedText(output);

  return (
    <Frame>
      <div className="flex gap-1.5 px-2 py-1">
        <span aria-hidden="true" className="select-none text-muted-foreground">
          $
        </span>
        <span className="wrap-break-word min-w-0 whitespace-pre-wrap">
          {command}
        </span>
      </div>
      {visible.shown.length > 0 ? (
        <pre
          aria-label="Command output"
          className="overflow-x-auto border-t px-2 py-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          role="region"
          tabIndex={0}
        >
          {visible.shown}
        </pre>
      ) : null}
      <MoreLines hidden={visible.hidden} onExpand={visible.expand} />
    </Frame>
  );
}

function OutputText({ text }: { text: string }) {
  const visible = useTruncatedText(text);

  return (
    <Frame>
      <pre
        aria-label="Tool output"
        className="overflow-x-auto px-2 py-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        role="region"
        tabIndex={0}
      >
        {visible.shown}
      </pre>
      <MoreLines hidden={visible.hidden} onExpand={visible.expand} />
    </Frame>
  );
}

// biome-ignore-end lint/a11y/useSemanticElements: scroll containers above
// biome-ignore-end lint/a11y/noNoninteractiveTabindex: scroll containers above

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-muted/40 font-mono text-[0.6875rem] leading-relaxed"
      data-slot="activity-detail"
    >
      {children}
    </div>
  );
}

function MoreLines({
  hidden,
  onExpand,
}: {
  hidden: number;
  onExpand: () => void;
}) {
  if (hidden === 0) {
    return null;
  }

  return (
    <button
      className="w-full border-t px-2 py-1 text-left text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={onExpand}
      type="button"
    >
      {`Show ${hidden} more ${hidden === 1 ? "line" : "lines"}`}
    </button>
  );
}
