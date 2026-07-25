"use client";

import { createContext, use, useMemo } from "react";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type ClaudeModel, useClaudeModel } from "@/hooks/use-claude-model";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";

export type Studio = ClaudeEffort & ClaudeModel & Workspace;

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
  const workspace = useWorkspace(settings);
  const model = useClaudeModel(settings);
  const effort = useClaudeEffort(settings);

  const studio = useMemo(
    () => ({ ...workspace, ...model, ...effort }),
    [effort, model, workspace]
  );

  if (!workspace.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={studio}>{children}</StudioContext>;
}
