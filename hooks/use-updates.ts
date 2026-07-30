"use client";

import type { Update } from "@tauri-apps/plugin-updater";
import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  advance,
  checkForUpdate,
  type Download,
  fetchStudioBuild,
  installUpdate,
  NOTHING_DOWNLOADED,
  type Release,
  releaseOf,
  restartStudio,
} from "@/lib/studio/updates";
import type { AppEnvironment, StudioBuild } from "@/shared/ipc";

const CORE_PENDING = "Waiting for the Tauri core";
const IS_DEVELOPMENT =
  "This is a development build — it updates when you rebuild it";

export interface Updates {
  check: () => Promise<void>;
  download: Download | null;
  environment: AppEnvironment | null;
  error: string | null;
  hasChecked: boolean;
  install: () => Promise<void>;
  isChecking: boolean;
  isInstalling: boolean;
  release: Release | null;
  unavailable: string | null;
  version: string | null;
}

export function useUpdates(): Updates {
  const [build, setBuild] = useState<StudioBuild | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [download, setDownload] = useState<Download | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const offered = useRef<Update | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;

    Effect.runPromiseExit(fetchStudioBuild).then((exit) => {
      if (live && Exit.isSuccess(exit)) {
        setBuild(exit.value);
      }
    });

    return () => {
      live = false;
    };
  }, []);

  const check = useCallback(async () => {
    if (busy.current) {
      return;
    }

    busy.current = true;
    setChecking(true);
    setError(null);

    const exit = await Effect.runPromiseExit(checkForUpdate);

    busy.current = false;
    setChecking(false);
    setHasChecked(true);

    if (Exit.isFailure(exit)) {
      setError(causeMessage(exit.cause));
      return;
    }

    offered.current = exit.value;
    setRelease(exit.value === null ? null : releaseOf(exit.value));
  }, []);

  const install = useCallback(async () => {
    const update = offered.current;

    if (busy.current || update === null) {
      return;
    }

    busy.current = true;
    setError(null);
    setDownload(NOTHING_DOWNLOADED);

    const exit = await Effect.runPromiseExit(
      installUpdate(update, (event) => {
        setDownload((seen) => advance(seen ?? NOTHING_DOWNLOADED, event));
      })
    );

    if (Exit.isFailure(exit)) {
      busy.current = false;
      setDownload(null);
      setError(causeMessage(exit.cause));
      return;
    }

    await Effect.runPromiseExit(restartStudio);
  }, []);

  const isProduction = build?.environment === "production";

  useEffect(() => {
    if (!isProduction || hasChecked) {
      return;
    }

    check().catch(() => undefined);
  }, [check, hasChecked, isProduction]);

  return useMemo(
    () => ({
      check,
      download,
      environment: build?.environment ?? null,
      error,
      hasChecked,
      install,
      isChecking,
      isInstalling: download !== null,
      release,
      unavailable: unavailableOf(build),
      version: build?.version ?? null,
    }),
    [build, check, download, error, hasChecked, install, isChecking, release]
  );
}

function unavailableOf(build: StudioBuild | null): string | null {
  if (build === null) {
    return CORE_PENDING;
  }

  return build.environment === "development" ? IS_DEVELOPMENT : null;
}
