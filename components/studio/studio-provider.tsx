"use client";

import { createContext, use } from "react";
import {
  type ProjectFolder,
  useProjectFolder,
} from "@/hooks/use-project-folder";

const StudioContext = createContext<ProjectFolder | null>(null);

export function useStudio(): ProjectFolder {
  const value = use(StudioContext);
  if (!value) {
    throw new Error("useStudio must be called inside <StudioProvider>.");
  }
  return value;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const folder = useProjectFolder();

  if (!folder.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={folder}>{children}</StudioContext>;
}
