"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface SettingsDialog {
  isOpen: boolean;
  open: () => void;
  setOpen: (open: boolean) => void;
}

// Cmd+, is the standard macOS settings shortcut. The listener lives here, not
// in the pane, so the dialog opens even while the sidebar is hidden.
export function useSettingsDialog(): SettingsDialog {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return useMemo(() => ({ isOpen, open, setOpen }), [isOpen, open, setOpen]);
}
