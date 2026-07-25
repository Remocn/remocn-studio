"use client";

import { useCallback, useMemo } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";

const PICKER_TITLE = "Locate the project folder";

export interface LocateProject {
  locate: () => void;
  locateError: string | null;
}

export function useLocateProject(
  projectId: string | null,
  relocate: (projectId: string, path: string) => Promise<unknown>
): LocateProject {
  const { error, pick } = useFolderPicker(PICKER_TITLE);

  const locate = useCallback(async () => {
    if (projectId === null) {
      return;
    }

    const picked = await pick();
    if (picked !== null) {
      await relocate(projectId, picked);
    }
  }, [pick, projectId, relocate]);

  return useMemo(() => ({ locate, locateError: error }), [error, locate]);
}
