"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { pickFolder } from "@/lib/studio/shell";

export interface FolderPicker {
  error: string | null;
  pick: () => Promise<string | null>;
}

export function useFolderPicker(title: string): FolderPicker {
  const { error, run } = useAsyncAction();

  const pick = useCallback(() => run(pickFolder(title)), [run, title]);

  return { error, pick };
}
