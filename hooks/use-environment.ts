"use client";

import { Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  checkEnvironment,
  installProject,
  isBlocked,
  merged,
  unresolved,
} from "@/lib/studio/environment";
import type { PreviewComposition } from "@/lib/studio/preview";
import type { EnvironmentCheck } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

export interface Environment {
  checks: readonly EnvironmentCheck[];
  error: string | null;
  install: () => void;
  isBlocking: boolean;
  isChecking: boolean;
  isInstalling: boolean;
  output: string | null;
  recheck: () => void;
  troubles: readonly EnvironmentCheck[];
}

const NONE: readonly EnvironmentCheck[] = [];

type Running = Fiber.Fiber<unknown, unknown>;

export function useEnvironment(
  projectId: string | null,
  pick: PreviewComposition | null,
  provider: AgentProvider
): Environment {
  const [checks, setChecks] = useState<readonly EnvironmentCheck[]>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const running = useRef<Running | null>(null);

  const stop = useCallback(() => {
    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
      running.current = null;
    }
  }, []);

  const check = useCallback(
    (target: string, force: boolean) => {
      stop();
      setIsChecking(true);

      running.current = Effect.runFork(
        checkEnvironment(target, force, provider).pipe(
          Effect.onExit((exit) =>
            Effect.sync(() => {
              running.current = null;
              setIsChecking(false);

              if (Exit.isSuccess(exit)) {
                setChecks(exit.value.checks);
                setError(null);
                return;
              }

              const message = causeMessage(exit.cause);
              if (message !== null) {
                setError(message);
              }
            })
          )
        )
      );
    },
    [provider, stop]
  );

  useEffect(() => {
    if (projectId === null) {
      setChecks(NONE);
      setError(null);
      setOutput(null);
      return;
    }

    check(projectId, false);

    return stop;
  }, [check, projectId, stop]);

  const recheck = useCallback(() => {
    if (projectId !== null) {
      check(projectId, true);
    }
  }, [check, projectId]);

  const install = useCallback(() => {
    if (projectId === null || isInstalling) {
      return;
    }

    setIsInstalling(true);
    setOutput(null);

    Effect.runFork(
      installProject(projectId, (event) => {
        setOutput(event.line);
      }).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            setIsInstalling(false);
            setOutput(null);

            if (Exit.isSuccess(exit)) {
              setError(null);
              check(projectId, false);
              return;
            }

            const message = causeMessage(exit.cause);
            if (message !== null) {
              setError(message);
            }
          })
        )
      )
    );
  }, [check, isInstalling, projectId]);

  const shown = useMemo(() => merged(checks, pick), [checks, pick]);

  return useMemo(
    () => ({
      checks: shown,
      error,
      install,
      isBlocking: isBlocked(shown, provider),
      isChecking,
      isInstalling,
      output,
      recheck,
      troubles: unresolved(shown),
    }),
    [error, install, isChecking, isInstalling, output, provider, recheck, shown]
  );
}
