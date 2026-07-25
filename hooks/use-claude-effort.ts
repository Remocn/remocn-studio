"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { type StudioSettings, saveClaudeEffort } from "@/lib/studio/settings";
import { type EffortLevel, isEffortLevel } from "@/shared/ipc";

export interface ClaudeEffort {
  claudeEffort: EffortLevel | null;
  onEffortChange: (value: string) => void;
}

export function useClaudeEffort(settings: StudioSettings | null): ClaudeEffort {
  const [chosen, setChosen] = useState<EffortLevel | null | undefined>(
    undefined
  );

  const onEffortChange = useCallback((value: string) => {
    const effort = isEffortLevel(value) ? value : null;
    setChosen(effort);
    Effect.runFork(saveClaudeEffort(effort));
  }, []);

  return useMemo(
    () => ({
      claudeEffort:
        chosen === undefined ? (settings?.claudeEffort ?? null) : chosen,
      onEffortChange,
    }),
    [chosen, onEffortChange, settings]
  );
}
