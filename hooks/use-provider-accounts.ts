"use client";

import { Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import { providerAccounts } from "@/lib/studio/agent";
import type { EnvironmentCheck } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

export type ProviderAccounts = Partial<Record<AgentProvider, EnvironmentCheck>>;

// One row per provider, asked once per app run — the transport itself waits
// for the sidecar to come up, and the probes share project.check's cache, so
// a warm answer costs nothing. The picker treats a provider it has no row
// for as available, because "unknown" must never read as "signed out".
export function useProviderAccounts(): ProviderAccounts {
  const [accounts, setAccounts] = useState<ProviderAccounts>({});
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) {
      return;
    }
    asked.current = true;

    Effect.runFork(
      providerAccounts().pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            const byProvider: Record<string, EnvironmentCheck> = {};
            for (const row of rows) {
              byProvider[row.id] = row;
            }
            setAccounts(byProvider);
          })
        ),
        Effect.ignore
      )
    );
  }, []);

  return accounts;
}
