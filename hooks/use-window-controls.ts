"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "effect";
import { useMemo } from "react";

type WindowOperation = "close" | "minimize" | "toggleMaximize";

// Chrome, not a feature: a window manager that ignores a request (a tiling one
// with no minimise) or a page without a core answers nothing, and the person
// is never shown an error for a window operation. Close goes through the
// core's own close request, so the quit guard sees it like any other quit.
const operate = (operation: WindowOperation) =>
  Effect.runFork(
    Effect.tryPromise(() => getCurrentWindow()[operation]()).pipe(Effect.ignore)
  );

export interface WindowControls {
  readonly onClose: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
}

export function useWindowControls(): WindowControls {
  return useMemo(
    () => ({
      onClose: () => {
        operate("close");
      },
      onMinimize: () => {
        operate("minimize");
      },
      onToggleMaximize: () => {
        operate("toggleMaximize");
      },
    }),
    []
  );
}
