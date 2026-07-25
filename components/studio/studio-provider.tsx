"use client";

import { createContext, use, useMemo } from "react";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type ClaudeModel, useClaudeModel } from "@/hooks/use-claude-model";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import {
  type ProjectFolder,
  useProjectFolder,
} from "@/hooks/use-project-folder";

export type Studio = ClaudeEffort & ClaudeModel & ProjectFolder;

const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const value = use(StudioContext);
  if (value === null) {
    throw new Error("useStudio must be called inside <StudioProvider>.");
  }
  return value;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const settings = useHydratedSettings();
  const folder = useProjectFolder(settings);
  const model = useClaudeModel(settings);
  const effort = useClaudeEffort(settings);

  const studio = useMemo(
    () => ({ ...folder, ...model, ...effort }),
    [effort, folder, model]
  );

  if (!folder.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={studio}>{children}</StudioContext>;
}
