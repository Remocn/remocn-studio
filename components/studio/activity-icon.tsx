"use client";

import {
  BotIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FilePlusIcon,
  FolderSearchIcon,
  GlobeIcon,
  ListTodoIcon,
  type LucideIcon,
  NotebookIcon,
  NotebookPenIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityState } from "@/shared/ipc";

const ICONS: ReadonlyMap<string, LucideIcon> = new Map<string, LucideIcon>([
  ["Bash", TerminalIcon],
  ["Edit", PencilIcon],
  ["ExitPlanMode", ClipboardCheckIcon],
  ["Glob", FolderSearchIcon],
  ["Grep", SearchIcon],
  ["MultiEdit", PencilIcon],
  ["NotebookEdit", NotebookPenIcon],
  ["NotebookRead", NotebookIcon],
  ["Read", EyeIcon],
  ["Task", BotIcon],
  ["TodoWrite", ListTodoIcon],
  ["WebFetch", GlobeIcon],
  ["WebSearch", GlobeIcon],
  ["Write", FilePlusIcon],
]);

const STATES: Record<ActivityState, string> = {
  done: "text-muted-foreground",
  failed: "text-destructive",
  running: "animate-pulse text-amber-500",
};

export function ActivityIcon({
  name,
  state,
}: {
  name: string;
  state: ActivityState;
}) {
  const Icon = ICONS.get(name) ?? WrenchIcon;

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", STATES[state])}
    />
  );
}
