"use client";

import { FileTextIcon } from "@/components/icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsPrimitive } from "@/components/ui/tabs";
import type { Docs } from "@/hooks/use-docs";
import { cn } from "@/lib/utils";
import { DocTabs } from "./doc-tabs";
import { Markdown } from "./markdown";
import { PaneBody } from "./pane";

/**
 * The right pane's second mode: the documents the production pipeline writes,
 * read where the person looks for the result of the work rather than in a
 * file tree.
 */
export function DocsView({ docs }: { docs: Docs }) {
  if (docs.tabs.length === 0) {
    return (
      <PaneBody>
        <NoDocuments folder={docs.folder} />
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <TabsPrimitive.Root
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        onValueChange={docs.onPickTab}
        value={docs.openPath}
      >
        <DocTabs tabs={docs.tabs} />

        <TabsPrimitive.Panel
          className="min-h-0 flex-1 overflow-y-auto outline-none"
          value={docs.openPath}
        >
          <Body docs={docs} />
        </TabsPrimitive.Panel>
      </TabsPrimitive.Root>
    </PaneBody>
  );
}

function Body({ docs }: { docs: Docs }) {
  if (docs.error !== null) {
    return (
      <p
        className="px-6 py-8 text-center text-destructive text-xs [overflow-wrap:anywhere]"
        role="alert"
      >
        {docs.error}
      </p>
    );
  }

  if (docs.open === null) {
    return docs.isLoading ? (
      <DocumentSkeleton />
    ) : (
      <NoDocuments folder={docs.folder} />
    );
  }

  return (
    <article className="mx-auto max-w-[65ch] px-6 py-6">
      <Markdown isAnimated={false}>{docs.open.text}</Markdown>
    </article>
  );
}

const SKELETON_LINES = [
  { id: "a", width: "w-full" },
  { id: "b", width: "w-11/12" },
  { id: "c", width: "w-4/5" },
  { id: "d", width: "w-full" },
  { id: "e", width: "w-2/3" },
];

function DocumentSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the document"
      className="mx-auto flex max-w-[65ch] animate-fade-in flex-col gap-3 px-6 py-6"
      role="status"
    >
      <Skeleton className="mb-2 h-5 w-2/5 rounded-sm" />
      {SKELETON_LINES.map((line) => (
        <Skeleton
          className={cn("h-3.5 rounded-sm", line.width)}
          key={line.id}
        />
      ))}
    </div>
  );
}

function NoDocuments({ folder }: { folder: string | null }) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>No documents yet</EmptyTitle>
        <EmptyDescription>
          Analysis, brand, script and motion are written to{" "}
          <span className="font-mono text-[0.9em]">
            {folder === null ? "the video's docs folder" : folderName(folder)}
          </span>{" "}
          as the video is planned. Ask for a video to start one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// The absolute path is long enough to wrap three times in a 360px pane, and
// the part that says anything is the video's own folder.
function folderName(folder: string): string {
  const parts = folder.split("/").filter((part) => part !== "");

  return parts.slice(-3).join("/");
}
