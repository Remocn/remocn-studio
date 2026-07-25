"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { saveProjectFolder } from "@/lib/studio/settings";

const PICKER_TITLE = "Open Remotion project";

export interface ProjectFolder {
  folderError: string | null;
  isReady: boolean;
  openFolder: () => Promise<void>;
  projectFolder: string | null;
}

export function useProjectFolder(): ProjectFolder {
  const settings = useHydratedSettings();
  const { error, pick } = useFolderPicker(PICKER_TITLE);
  const [chosen, setChosen] = useState<string | null>(null);

  const openFolder = useCallback(async () => {
    const folder = await pick();
    if (folder === null) {
      return;
    }
    setChosen(folder);
    Effect.runFork(saveProjectFolder(folder));
  }, [pick]);

  return useMemo(
    () => ({
      folderError: error,
      isReady: settings !== null,
      openFolder,
      projectFolder: chosen ?? settings?.projectFolder ?? null,
    }),
    [chosen, error, openFolder, settings]
  );
}
