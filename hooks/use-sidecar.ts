"use client";

import { useCallback, useMemo } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useSidecarStatus } from "@/hooks/use-sidecar-status";
import { restartSidecar } from "@/lib/studio/sidecar";
import type { SidecarPhase, SidecarStatus } from "@/shared/ipc";

export interface Sidecar {
  isReady: boolean;
  phase: SidecarPhase | "unknown";
  restart: () => Promise<void>;
  restartError: string | null;
  status: SidecarStatus | null;
}

export function useSidecar(): Sidecar {
  const status = useSidecarStatus();
  const { error, run } = useAsyncAction();

  const restart = useCallback(async () => {
    await run(restartSidecar);
  }, [run]);

  return useMemo(
    () => ({
      isReady: status?.phase === "ready",
      phase: status === null ? "unknown" : status.phase,
      restart,
      restartError: error,
      status,
    }),
    [error, restart, status]
  );
}
