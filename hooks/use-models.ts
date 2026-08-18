"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_MODELS } from "@/lib/studio/models";
import { type StudioSettings, saveProviderModel } from "@/lib/studio/settings";
import type { AgentProvider } from "@/shared/providers";

export interface StudioModels {
  models: Record<AgentProvider, string>;
  onPickModel: (provider: AgentProvider, value: string) => void;
}

export function useModels(settings: StudioSettings | null): StudioModels {
  const [chosen, setChosen] = useState<Partial<Record<AgentProvider, string>>>(
    {}
  );

  const onPickModel = useCallback((provider: AgentProvider, value: string) => {
    setChosen((current) => ({ ...current, [provider]: value }));
    Effect.runFork(saveProviderModel(provider, value));
  }, []);

  return useMemo(
    () => ({
      models: {
        claude: chosen.claude ?? settings?.claudeModel ?? DEFAULT_MODELS.claude,
        codex: chosen.codex ?? settings?.codexModel ?? DEFAULT_MODELS.codex,
        copilot:
          chosen.copilot ?? settings?.copilotModel ?? DEFAULT_MODELS.copilot,
        grok: chosen.grok ?? settings?.grokModel ?? DEFAULT_MODELS.grok,
      },
      onPickModel,
    }),
    [chosen, onPickModel, settings]
  );
}
