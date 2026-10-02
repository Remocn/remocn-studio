"use client";

import { Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  checkEnvironment,
  installProject,
  isBlocked,
  merged,
  openNodeDownload,
  unresolved,
  upgradeProject,
} from "@/lib/studio/environment";
import type { PreviewComposition } from "@/lib/studio/preview";
import { failedProviders } from "@/lib/studio/setup";
import type { EnvironmentCheck } from "@/shared/ipc";
import { type AgentProvider, PROVIDER_INFO } from "@/shared/providers";
import { useRecheckOnFocus } from "./use-recheck-on-focus";

export interface Environment {
  checks: readonly EnvironmentCheck[];
  error: string | null;
  install: () => void;
  installNode: () => void;
  isBlocking: boolean;
  isChecking: boolean;
  isInstalling: boolean;
  isUpgrading: boolean;
  output: string | null;
  recheck: () => void;
  troubles: readonly EnvironmentCheck[];
  upgrade: () => void;
}

export function upgradeFix(
  checks: readonly EnvironmentCheck[]
): { packages: readonly string[]; version: string } | null {
  for (const check of checks) {
    if (check.fix?.type === "upgrade") {
      return { packages: check.fix.packages, version: check.fix.version };
    }
  }

  return null;
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
  const [isUpgrading, setIsUpgrading] = useState(false);
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

  const getNode = useCallback(() => {
    Effect.runPromiseExit(openNodeDownload).then((exit) => {
      setError(Exit.isFailure(exit) ? causeMessage(exit.cause) : null);
    });
  }, []);

  const shown = useMemo(
    () => merged(checks, pick, PROVIDER_INFO[provider].name),
    [checks, pick, provider]
  );

  const upgrade = useCallback(() => {
    const fix = upgradeFix(shown);

    if (projectId === null || isUpgrading || fix === null) {
      return;
    }

    setIsUpgrading(true);
    setOutput(null);

    Effect.runFork(
      upgradeProject(projectId, fix.packages, fix.version, (event) => {
        setOutput(event.line);
      }).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            setIsUpgrading(false);
            setOutput(null);

            if (Exit.isSuccess(exit)) {
              setError(null);
              check(projectId, true);
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
  }, [check, isUpgrading, projectId, shown]);

  useRecheckOnFocus(failedProviders(shown).length > 0, recheck);

  return useMemo(
    () => ({
      checks: shown,
      error,
      install,
      installNode: getNode,
      isBlocking: isBlocked(shown, provider),
      isChecking,
      isInstalling,
      isUpgrading,
      output,
      recheck,
      troubles: unresolved(shown),
      upgrade,
    }),
    [
      error,
      getNode,
      install,
      isChecking,
      isInstalling,
      isUpgrading,
      output,
      provider,
      recheck,
      shown,
      upgrade,
    ]
  );
}
