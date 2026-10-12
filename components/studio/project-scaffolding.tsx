"use client";

import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useNow } from "@/hooks/use-now";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import { runningTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";
import { FailureDetails } from "./failure-text";
import { useStudio } from "./studio-provider";

export function ProjectScaffolding() {
  const { activeProject, scaffolds, onCancelScaffold, onRetryScaffold } =
    useStudio();
  if (activeProject === null) {
    return null;
  }
  return (
    <Scaffolding
      onCancel={onCancelScaffold}
      onRetry={onRetryScaffold}
      projectId={activeProject.id}
      scaffold={scaffolds.get(activeProject.id)}
    />
  );
}

const DOING: Record<ScaffoldState["step"], string> = {
  install: "Installing dependencies…",
  template: "Copying the template…",
};

const FAILED: Record<ScaffoldState["step"], string> = {
  install: "Could not install the dependencies.",
  template: "Could not copy the template.",
};

const CANCELLED: Record<ScaffoldState["step"], string> = {
  install: "The install was cancelled.",
  template: "Setting up the project was cancelled.",
};

// Scaffolding belongs to the project, so it reports under the switcher rather
// than on a video: the template and the install are what the whole folder is
// waiting for, not one composition in it.
function Scaffolding({
  onCancel,
  onRetry,
  projectId,
  scaffold,
}: {
  onCancel: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState | undefined;
}) {
  if (scaffold === undefined) {
    return null;
  }

  if (scaffold.isRunning) {
    return (
      <ScaffoldRunning
        onCancel={onCancel}
        projectId={projectId}
        scaffold={scaffold}
      />
    );
  }

  return (
    <div className="flex animate-fade-in flex-col gap-1.5 px-3 py-1">
      <p
        className={cn(
          "text-xs",
          scaffold.cancelled ? "text-muted-foreground" : "text-destructive"
        )}
        role={scaffold.cancelled ? "status" : "alert"}
      >
        {scaffold.cancelled ? CANCELLED[scaffold.step] : FAILED[scaffold.step]}
      </p>
      {scaffold.error === null ? null : (
        <FailureDetails details={scaffold.error} />
      )}
      <Button
        className="self-start text-xs"
        onClick={onRetry}
        size="sm"
        value={projectId}
        variant="outline"
      >
        Try again
      </Button>
    </div>
  );
}

function ScaffoldRunning({
  onCancel,
  projectId,
  scaffold,
}: {
  onCancel: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState;
}) {
  const now = useNow("1 second");

  return (
    <div
      className="flex animate-fade-in items-center gap-2 px-3 py-1 text-muted-foreground text-xs"
      role="status"
    >
      <Spinner className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{DOING[scaffold.step]}</span>
      <span className="shrink-0 tabular-nums">
        {runningTime(scaffold.startedAt, now)}
      </span>
      <Button
        className="-my-1 shrink-0 text-xs"
        onClick={onCancel}
        size="xs"
        value={projectId}
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}
