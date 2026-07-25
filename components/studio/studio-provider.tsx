"use client";

import { open } from "@tauri-apps/plugin-dialog";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hydrateSettings, saveProjectFolder } from "@/lib/studio/settings";

interface StudioContextValue {
  folderError: string | null;
  openFolder: () => Promise<void>;
  projectFolder: string | null;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const value = use(StudioContext);
  if (!value) {
    throw new Error("useStudio must be called inside <StudioProvider>.");
  }
  return value;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [projectFolder, setProjectFolder] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hydrateSettings().then((settings) => {
      if (cancelled) {
        return;
      }
      setProjectFolder(settings.projectFolder);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openFolder = useCallback(async () => {
    let picked: string | null;
    try {
      picked = await open({
        directory: true,
        multiple: false,
        title: "Open Remotion project",
      });
    } catch (cause) {
      setFolderError(cause instanceof Error ? cause.message : String(cause));
      return;
    }

    setFolderError(null);
    if (picked === null) {
      return;
    }

    setProjectFolder(picked);
    saveProjectFolder(picked);
  }, []);

  const value = useMemo(
    () => ({ folderError, openFolder, projectFolder }),
    [folderError, openFolder, projectFolder]
  );

  if (!isHydrated) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={value}>{children}</StudioContext>;
}
