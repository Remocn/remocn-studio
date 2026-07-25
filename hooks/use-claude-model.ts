"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { type StudioSettings, saveClaudeModel } from "@/lib/studio/settings";

export interface ClaudeModel {
  claudeModel: string | null;
  onModelChange: (value: string) => void;
}

export function useClaudeModel(settings: StudioSettings | null): ClaudeModel {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);

  const onModelChange = useCallback((value: string) => {
    const model = value === "" ? null : value;
    setChosen(model);
    Effect.runFork(saveClaudeModel(model));
  }, []);

  return useMemo(
    () => ({
      claudeModel:
        chosen === undefined ? (settings?.claudeModel ?? null) : chosen,
      onModelChange,
    }),
    [chosen, onModelChange, settings]
  );
}
