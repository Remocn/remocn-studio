"use client";

import { FolderOpenIcon, FolderPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoWordmark } from "./logo-mark";

const STEPS = [
  {
    body: "The studio scaffolds a real Remotion project, or opens one you already have.",
    id: "project",
    title: "Start a project",
  },
  {
    body: "Say what the video should be. Claude writes actual Remotion components into that folder — TSX you can read, edit and keep.",
    id: "describe",
    title: "Describe the video",
  },
  {
    body: "The preview plays the code on disk as it changes. Click an element to comment on it, or snapshot a frame.",
    id: "watch",
    title: "Watch it, and point at it",
  },
  {
    body: "Rendered by the project's own Remotion, so the file is what you watched.",
    id: "export",
    title: "Export the mp4",
  },
];

export function Startup({
  onNewProject,
  onOpenFolder,
}: {
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  return (
    // Centred with `auto` margins rather than `justify-center`: the pane is a
    // scroll viewport, and a centred flex child taller than it loses its top
    // edge instead of scrolling to it.
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {/* No width of its own: the scroller column is already the composer's
          `max-w-2xl`, and this is the thing the composer is waiting under. */}
      <div className="m-auto flex w-full flex-col gap-10 py-6">
        <header className="flex flex-col gap-4">
          <LogoWordmark />
          <h3 className="text-balance font-semibold text-2xl leading-tight tracking-tight">
            Make a video by describing it
          </h3>
        </header>

        <ol aria-label="Getting started" className="flex w-full flex-col">
          {STEPS.map((step, index) => (
            <Step
              body={step.body}
              index={index}
              isLast={index === STEPS.length - 1}
              key={step.id}
              title={step.title}
            />
          ))}
        </ol>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onNewProject} size="lg">
              <FolderPlusIcon data-icon="inline-start" />
              New Project
            </Button>
            <Button onClick={onOpenFolder} size="lg" variant="ghost">
              <FolderOpenIcon data-icon="inline-start" />
              Open an existing project
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Needs bun, and a Claude Code you are already signed in to.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  body,
  index,
  isLast,
  title,
}: {
  body: string;
  index: number;
  isLast: boolean;
  title: string;
}) {
  return (
    <li className="flex gap-3">
      {/* The rule stretches to whatever the copy beside it needs, which is what
          makes four rows read as one sequence rather than four cards. */}
      <div className="flex flex-col items-center gap-1">
        {/* No `tabular-nums`: these four never change, and DM Sans pads a
            tabular "1" to the right of its slot, which reads as off-centre in
            a circle. `leading-none` drops the line box onto the glyph so the
            flex centring has nothing else to average. */}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card font-medium text-muted-foreground text-xs leading-none">
          {index + 1}
        </span>
        {isLast ? null : <span className="w-px flex-1 bg-border" />}
      </div>

      <div
        className={cn("flex min-w-0 flex-col gap-1", isLast ? null : "pb-5")}
      >
        <p className="font-medium text-base">{title}</p>
        <p className="text-pretty text-muted-foreground text-sm/relaxed">
          {body}
        </p>
      </div>
    </li>
  );
}
