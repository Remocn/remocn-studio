"use client";

import { type MouseEvent, useCallback, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  FolderPlusIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HINTS = [
  {
    body: "Click an element on the canvas to adjust its color, size or timing.",
    title: "Point at what you want to change",
  },
  {
    body: "Capture a frame or an area and attach it to your next message.",
    title: "Show, don’t describe",
  },
  {
    body: "Import DESIGN.md once. New videos inherit the project’s colors and typography.",
    title: "Keep every video on brand",
  },
  {
    body: "Save an animation as a component and reuse it in any video.",
    title: "Reuse what works",
  },
];

export function Startup({
  entrance,
  onNewProject,
  onOpenFolder,
}: {
  entrance: string | null;
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col items-center pt-[clamp(24px,calc(100dvh-784px),64px)] pb-8",
        entrance
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none h-[clamp(160px,calc(100dvh-434px),232px)] w-80 max-w-full shrink-0 select-none bg-[url('/design-system/welcome-ribbon.svg')] bg-center bg-contain bg-no-repeat"
      />
      <header className="mt-6 flex flex-col gap-2 text-center">
        <h3 className="text-balance font-semibold text-2xl leading-8 tracking-tight">
          Make a video by describing it
        </h3>
        <p className="text-pretty text-muted-foreground text-sm">
          Start a project, then tell your agent what to make.
        </p>
      </header>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          className="min-w-36"
          onClick={onNewProject}
          size="lg"
          variant="key-action"
        >
          <FolderPlusIcon />
          New project
        </Button>
        <Button
          className="min-w-[218px]"
          onClick={onOpenFolder}
          size="lg"
          variant="secondary"
        >
          <FolderOpenIcon />
          Open an existing project
        </Button>
      </div>
      <WelcomeHints />
      <p className="mt-7 text-center text-2xs text-muted-foreground">
        Needs Claude Code, Codex, GitHub Copilot or Grok Build, already signed
        in.
      </p>
    </div>
  );
}

function WelcomeHints() {
  const [index, setIndex] = useState(0);
  const hint = HINTS[index];
  const previous = useCallback(
    () => setIndex((current) => (current + HINTS.length - 1) % HINTS.length),
    []
  );
  const next = useCallback(
    () => setIndex((current) => (current + 1) % HINTS.length),
    []
  );
  const pick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setIndex(Number(event.currentTarget.value)),
    []
  );
  return (
    <section
      aria-label="Quick tips"
      className="mt-8 flex min-h-30 w-full max-w-[480px] flex-col gap-2 rounded-xl bg-field px-4 py-3"
    >
      <div className="flex h-7 items-center gap-2">
        <span className="text-2xs text-muted-foreground">Quick tip</span>
        <fieldset aria-label="Choose a tip" className="flex items-center">
          {HINTS.map((item, i) => (
            <button
              aria-current={i === index ? "true" : undefined}
              aria-label={`Tip ${i + 1}: ${item.title}`}
              className="flex size-6 items-center justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
              key={item.title}
              onClick={pick}
              type="button"
              value={i}
            >
              <span
                className={cn(
                  "h-1 rounded-[2px]",
                  i === index ? "w-3.5 bg-muted-foreground" : "w-1 bg-input"
                )}
              />
            </button>
          ))}
        </fieldset>
        <div className="ml-auto flex gap-1">
          <Button
            aria-label="Previous tip"
            onClick={previous}
            size="icon-sm"
            variant="secondary"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Next tip"
            onClick={next}
            size="icon-sm"
            variant="secondary"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="grid min-h-12 gap-1"
      >
        <div
          className="animate-fade-in [animation-duration:160ms] motion-reduce:animate-none"
          key={hint.title}
        >
          <p className="font-medium text-sm">{hint.title}</p>
          <p className="mt-1 text-muted-foreground text-xs">{hint.body}</p>
        </div>
      </div>
    </section>
  );
}
