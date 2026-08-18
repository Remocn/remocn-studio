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
import type { ToolVerb } from "@/shared/providers";

// The verb is the adapter's neutral vocabulary; the name map stays behind it
// for rows stored before verbs existed, and for names no adapter translates.
const VERB_ICONS: ReadonlyMap<ToolVerb, LucideIcon> = new Map<
  ToolVerb,
  LucideIcon
>([
  ["create", FilePlusIcon],
  ["edit", PencilIcon],
  ["find", FolderSearchIcon],
  ["plan", ClipboardCheckIcon],
  ["read", EyeIcon],
  ["run", TerminalIcon],
  ["search", SearchIcon],
  ["subagent", BotIcon],
  ["task", ListTodoIcon],
  ["web", GlobeIcon],
]);

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
  ["TaskCreate", ListTodoIcon],
  ["TaskGet", ListTodoIcon],
  ["TaskList", ListTodoIcon],
  ["TaskUpdate", ListTodoIcon],
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
  verb,
}: {
  name: string;
  state: ActivityState;
  verb: ToolVerb | null;
}) {
  const Icon =
    (verb === null ? undefined : VERB_ICONS.get(verb)) ??
    ICONS.get(name) ??
    WrenchIcon;

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", STATES[state])}
    />
  );
}
