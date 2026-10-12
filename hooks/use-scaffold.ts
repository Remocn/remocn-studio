"use client";

import { Cause, Effect, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { scaffoldProject } from "@/lib/studio/projects";
import type { Project, ScaffoldStep } from "@/shared/ipc";

export interface ScaffoldState {
  cancelled: boolean;
  error: string | null;
  isRunning: boolean;
  startedAt: number;
  step: ScaffoldStep;
}

export interface Scaffolds {
  onCancelScaffold: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetryScaffold: (event: MouseEvent<HTMLButtonElement>) => void;
  scaffolds: ReadonlyMap<string, ScaffoldState>;
  startScaffold: (projectId: string) => void;
}

type Running = Fiber.Fiber<Project, unknown>;

// A new project opens while its scaffold is still copying the template and
// installing. Whatever reads the folder then sees it half written, so it waits
// for this to turn false. A scaffold that failed or was cancelled is no longer
// running, and the folder can be read for what it lacks.
export function isSettingUp(
  scaffolds: ReadonlyMap<string, ScaffoldState>,
  projectId: string | null
): boolean {
  return projectId !== null && scaffolds.get(projectId)?.isRunning === true;
}

export function useScaffold(
  onScaffolded: (project: Project) => void
): Scaffolds {
  const [scaffolds, setScaffolds] = useState<
    ReadonlyMap<string, ScaffoldState>
  >(() => new Map());
  const running = useRef(new Map<string, Running | null>());

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
    (projectId: string) => {
      if (running.current.has(projectId)) {
        return;
      }
      running.current.set(projectId, null);
      write(projectId, {
        cancelled: false,
        error: null,
        isRunning: true,
        startedAt: Date.now(),
        step: "template",
      });

      const fiber = Effect.runFork(
        scaffoldProject(projectId, (event) => {
          if (event.type === "started") {
            write(projectId, {
              cancelled: false,
              error: null,
              isRunning: true,
              startedAt: Date.now(),
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
                  const seen = current.get(projectId);
                  next.set(projectId, {
                    cancelled: Cause.hasInterruptsOnly(exit.cause),
                    error: causeMessage(exit.cause),
                    isRunning: false,
                    startedAt: seen?.startedAt ?? Date.now(),
                    step: seen?.step ?? "template",
                  });
                  return next;
                });
                return;
              }

              write(projectId, null);
              onScaffolded(exit.value);
            })
          )
        )
      );
      if (running.current.has(projectId)) {
        running.current.set(projectId, fiber);
      }
    },
    [onScaffolded, write]
  );

  const onRetryScaffold = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      startScaffold(event.currentTarget.value);
    },
    [startScaffold]
  );

  const onCancelScaffold = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const fiber = running.current.get(event.currentTarget.value);
      if (fiber !== undefined && fiber !== null) {
        Effect.runFork(Fiber.interrupt(fiber));
      }
    },
    []
  );

  return useMemo(
    () => ({ onCancelScaffold, onRetryScaffold, scaffolds, startScaffold }),
    [onCancelScaffold, onRetryScaffold, scaffolds, startScaffold]
  );
}
