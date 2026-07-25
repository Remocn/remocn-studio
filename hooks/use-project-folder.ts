"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import { type StudioSettings, saveProjectFolder } from "@/lib/studio/settings";

const PICKER_TITLE = "Open Remotion project";

export interface ProjectFolder {
  folderError: string | null;
  isReady: boolean;
  pickFolder: () => Promise<string | null>;
  projectFolder: string | null;
  setProjectFolder: (folder: string) => void;
}

export function useProjectFolder(
  settings: StudioSettings | null
): ProjectFolder {
  const { error, pick } = useFolderPicker(PICKER_TITLE);
  const [chosen, setChosen] = useState<string | null>(null);

  const setProjectFolder = useCallback((folder: string) => {
    setChosen(folder);
    Effect.runFork(saveProjectFolder(folder));
  }, []);

  const pickFolder = useCallback(async () => {
    const folder = await pick();
    if (folder !== null) {
      setProjectFolder(folder);
    }
    return folder;
  }, [pick, setProjectFolder]);

  return useMemo(
    () => ({
      folderError: error,
      isReady: settings !== null,
      pickFolder,
      projectFolder: chosen ?? settings?.projectFolder ?? null,
      setProjectFolder,
    }),
    [chosen, error, pickFolder, setProjectFolder, settings]
  );
}
