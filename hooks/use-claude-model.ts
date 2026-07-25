"use client";

import { Effect } from "effect";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { type StudioSettings, saveClaudeModel } from "@/lib/studio/settings";

export interface ClaudeModel {
  claudeModel: string | null;
  onModelChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

export function useClaudeModel(settings: StudioSettings | null): ClaudeModel {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);

  const onModelChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const model = event.target.value === "" ? null : event.target.value;
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
