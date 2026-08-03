"use client";

import { Effect } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { DEFAULT_FORMAT, sizeOf } from "@/lib/studio/formats";
import { scaffoldProject } from "@/lib/studio/projects";
import type { Project, ScaffoldStep, VideoSize } from "@/shared/ipc";

export interface ScaffoldState {
  error: string | null;
  isRunning: boolean;
  step: ScaffoldStep;
}

export interface Scaffolds {
  onRetryScaffold: (event: MouseEvent<HTMLButtonElement>) => void;
  scaffolds: ReadonlyMap<string, ScaffoldState>;
  startScaffold: (projectId: string, size: VideoSize) => void;
}

const STARTED: ScaffoldState = {
  error: null,
  isRunning: true,
  step: "template",
};

export function useScaffold(
  onScaffolded: (project: Project) => void
): Scaffolds {
  const [scaffolds, setScaffolds] = useState<
    ReadonlyMap<string, ScaffoldState>
  >(() => new Map());
  const running = useRef(new Set<string>());
  const sizes = useRef(new Map<string, VideoSize>());

  const write = useCallback(
    (projectId: string, state: ScaffoldState | null) => {
      setScaffolds((current) => {
        const next = new Map(current);
        if (state === null) {
          next.delete(projectId);
        } else {
          next.set(projectId, state);
        }
        return next;
      });
    },
    []
  );

  const startScaffold = useCallback(
    (projectId: string, size: VideoSize) => {
      if (running.current.has(projectId)) {
        return;
      }
      running.current.add(projectId);
      sizes.current.set(projectId, size);
      write(projectId, STARTED);

      Effect.runFork(
        scaffoldProject(projectId, size, (event) => {
          if (event.type === "started") {
            write(projectId, {
              error: null,
              isRunning: true,
              step: event.step,
            });
          }
        }).pipe(
          Effect.onExit((exit) =>
            Effect.sync(() => {
              running.current.delete(projectId);

              if (exit._tag === "Failure") {
                setScaffolds((current) => {
                  const next = new Map(current);
                  const seen = current.get(projectId) ?? STARTED;
                  next.set(projectId, {
                    error: causeMessage(exit.cause),
                    isRunning: false,
                    step: seen.step,
                  });
                  return next;
                });
                return;
              }

              sizes.current.delete(projectId);
              write(projectId, null);
              onScaffolded(exit.value);
            })
          )
        )
      );
    },
    [onScaffolded, write]
  );

  const onRetryScaffold = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const projectId = event.currentTarget.value;

      startScaffold(
        projectId,
        sizes.current.get(projectId) ?? sizeOf(DEFAULT_FORMAT)
      );
    },
    [startScaffold]
  );

  return useMemo(
    () => ({ onRetryScaffold, scaffolds, startScaffold }),
    [onRetryScaffold, scaffolds, startScaffold]
  );
}
