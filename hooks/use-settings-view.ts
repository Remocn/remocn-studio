"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentProvider } from "@/shared/providers";
import { useNavigationMotion } from "./use-navigation-motion";

export const SETTINGS_SECTIONS = [
  "project",
  "appearance",
  "behavior",
  "notifications",
  "hotkeys",
  "integrations",
  "updates",
  "feedback",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    typeof value === "string" &&
    (SETTINGS_SECTIONS as readonly string[]).includes(value)
  );
}

export interface SettingsView {
  animate: boolean;
  blocked: boolean;
  close: () => void;
  isOpen: boolean;
  open: () => void;
  openAccounts: (provider: AgentProvider) => void;
  openProject: (projectId: string) => void;
  projectId: string | null;
  provider: AgentProvider | null;
  section: SettingsSection;
  setOpen: (open: boolean) => void;
  setProjectDirty: (dirty: boolean) => void;
  setSection: (section: SettingsSection) => void;
}

// Settings is a view of the window rather than a dialog over it: it takes the
// whole window while open and the shell stays mounted underneath, so a turn,
// the preview and the sidecar carry on. Escape is the way back and its
// listener lives here, not in the pane, so it works while the sidebar is
// hidden; Cmd+, is a registry command and fires through use-shortcuts.
export function useSettingsView(
  activeProjectId: string | null = null
): SettingsView {
  const [isOpen, setIsOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const shouldAnimate = useNavigationMotion();
  const changeOpen = useCallback(
    (next: boolean) => {
      setAnimate(shouldAnimate());
      setIsOpen(next);
    },
    [shouldAnimate]
  );
  const [section, setSectionState] = useState<SettingsSection>("appearance");
  const [provider, setProvider] = useState<AgentProvider | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const dirty = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const setProjectDirty = useCallback((value: boolean) => {
    dirty.current = value;
    if (!value) {
      setBlocked(false);
    }
  }, []);
  const setSection = useCallback(
    (next: SettingsSection) => {
      if (dirty.current) {
        setBlocked(true);
        return;
      }
      if (next === "project") {
        setProjectId(activeProjectId);
      }
      setSectionState(next);
    },
    [activeProjectId]
  );
  const openProject = useCallback(
    (id: string) => {
      if (dirty.current) {
        setBlocked(true);
        return;
      }
      setProjectId(id);
      setSectionState("project");
      changeOpen(true);
    },
    [changeOpen]
  );

  const open = useCallback(() => {
    changeOpen(true);
  }, [changeOpen]);

  const openAccounts = useCallback(
    (target: AgentProvider) => {
      setSection("integrations");
      setProvider(target);
      changeOpen(true);
    },
    [changeOpen, setSection]
  );

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next && dirty.current) {
        setBlocked(true);
        return;
      }
      changeOpen(next);
      if (!next) {
        setProvider(null);
      }
    },
    [changeOpen]
  );

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A menu or a popover open on the page answers Escape first and
      // prevents the default; only an Escape nothing else wanted leaves.
      if (event.key === "Escape" && isOpen && !event.defaultPrevented) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  return useMemo(
    () => ({
      animate,
      blocked,
      close,
      isOpen,
      open,
      openAccounts,
      openProject,
      projectId,
      provider,
      section,
      setOpen,
      setProjectDirty,
      setSection,
    }),
    [
      animate,
      projectId,
      openProject,
      setProjectDirty,
      blocked,
      close,
      isOpen,
      open,
      openAccounts,
      provider,
      section,
      setOpen,
      setSection,
    ]
  );
}
