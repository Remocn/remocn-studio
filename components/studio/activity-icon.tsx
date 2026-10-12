"use client";

import {
  BotIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FilePlusIcon,
  FolderSearchIcon,
  GlobeIcon,
  type Icon,
  ListTodoIcon,
  NotebookIcon,
  NotebookPenIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ActivityState } from "@/shared/ipc";
import type { ToolVerb } from "@/shared/providers";

// The verb is the adapter's neutral vocabulary; the name map stays behind it
// for rows stored before verbs existed, and for names no adapter translates.
const VERB_ICONS: ReadonlyMap<ToolVerb, Icon> = new Map<ToolVerb, Icon>([
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

const ICONS: ReadonlyMap<string, Icon> = new Map<string, Icon>([
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
  running: "animate-pulse text-foreground",
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
  const Glyph =
    (verb === null ? undefined : VERB_ICONS.get(verb)) ??
    ICONS.get(name) ??
    WrenchIcon;

  return (
    <Glyph
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", STATES[state])}
    />
  );
}
