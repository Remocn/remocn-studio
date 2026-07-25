"use client";

import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";

export interface FolderPicker {
  error: string | null;
  pick: () => Promise<string | null>;
}

export function useFolderPicker(title: string): FolderPicker {
  const { error, run } = useAsyncAction();

  const pick = useCallback(
    () => run(() => open({ directory: true, multiple: false, title })),
    [run, title]
  );

  return { error, pick };
}
