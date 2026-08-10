"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/studio/models";
import { type StudioSettings, saveClaudeModel } from "@/lib/studio/settings";

export interface ClaudeModel {
  claudeModel: string;
  onModelChange: (value: string) => void;
}

export function useClaudeModel(settings: StudioSettings | null): ClaudeModel {
  const [chosen, setChosen] = useState<string | null>(null);

  const onModelChange = useCallback((value: string) => {
    setChosen(value);
    Effect.runFork(saveClaudeModel(value));
  }, []);

  return useMemo(
    () => ({
      claudeModel: chosen ?? settings?.claudeModel ?? DEFAULT_CLAUDE_MODEL,
      onModelChange,
    }),
    [chosen, onModelChange, settings]
  );
}
