"use client";

import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { providerAccounts } from "@/lib/studio/agent";
import type { EnvironmentCheck } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

export type ProviderAccounts = Partial<Record<AgentProvider, EnvironmentCheck>>;

export interface Accounts {
  isChecking: boolean;
  recheck: () => void;
  rows: ProviderAccounts;
}

// One row per provider, asked once per app run — the transport itself waits
// for the sidecar to come up, and the probes share project.check's cache, so
// a warm answer costs nothing. The picker treats a provider it has no row
// for as available, because "unknown" must never read as "signed out".
// Recheck forces the probes, for the account list in Settings.
export function useProviderAccounts(): Accounts {
  const [rows, setRows] = useState<ProviderAccounts>({});
  const [isChecking, setChecking] = useState(false);
  const asked = useRef(false);
  const busy = useRef(false);

  const ask = useCallback((force: boolean) => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setChecking(true);

    Effect.runFork(
      providerAccounts(force).pipe(
        Effect.tap((checks) =>
          Effect.sync(() => {
            const byProvider: Record<string, EnvironmentCheck> = {};
            for (const row of checks) {
              byProvider[row.id] = row;
            }
            setRows(byProvider);
          })
        ),
        Effect.ignore,
        Effect.ensuring(
          Effect.sync(() => {
            busy.current = false;
            setChecking(false);
          })
        )
      )
    );
  }, []);

  useEffect(() => {
    if (asked.current) {
      return;
    }
    asked.current = true;
    ask(false);
  }, [ask]);

  const recheck = useCallback(() => {
    ask(true);
  }, [ask]);

  return useMemo(
    () => ({ isChecking, recheck, rows }),
    [isChecking, recheck, rows]
  );
}
