import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";
import { commandOf, toolTargetParts } from "./activity";
import { isQuietCommand } from "./commands";

export type TranscriptItem =
  | { entry: TranscriptEntry; id: string; kind: "entry" }
  | { entries: readonly ActivityEntry[]; id: string; kind: "run" };

export interface RunSummary {
  detail: string;
  name: string;
  text: string;
}

const NOUNS: Record<string, string> = {
  Bash: "commands",
  Glob: "patterns",
  Grep: "searches",
  NotebookRead: "notebooks",
  Read: "files",
  WebFetch: "pages",
  WebSearch: "searches",
};

const QUIET_TOOLS = new Set([
  "Glob",
  "Grep",
  "NotebookRead",
  "Read",
  "WebFetch",
  "WebSearch",
]);

const MIXED_NAME = "Explored";
const MIXED_NOUN = "items";

const RUN_MINIMUM = 2;

export function groupActivity(
  entries: readonly TranscriptEntry[]
): readonly TranscriptItem[] {
  const items: TranscriptItem[] = [];
  let run: ActivityEntry[] = [];

  const settle = () => {
    if (run.length >= RUN_MINIMUM) {
      items.push({ entries: run, id: run[0].id, kind: "run" });
    } else {
      items.push(
        ...run.map(
          (entry): TranscriptItem => ({
            entry,
            id: entry.id,
            kind: "entry",
          })
        )
      );
    }
    run = [];
  };

  for (const entry of entries) {
    if (isQuiet(entry)) {
      run.push(entry);
      continue;
    }

    settle();
    items.push({ entry, id: entry.id, kind: "entry" });
  }

  settle();

  return items;
}

export function runSummary(
  entries: readonly ActivityEntry[],
  cwd: string | null
): RunSummary {
  const names = new Set(entries.map((entry) => entry.name));
  const only = names.size === 1 ? [...names][0] : null;
  const name = only ?? MIXED_NAME;
  const noun = only === null ? MIXED_NOUN : (NOUNS[only] ?? MIXED_NOUN);
  const folder = sharedFolder(entries, cwd);

  const detail =
    folder === null
      ? `${entries.length} ${noun}`
      : `${entries.length} ${noun} in ${folder}`;

  return { detail, name, text: `${name} ${detail}` };
}

function isQuiet(entry: TranscriptEntry): entry is ActivityEntry {
  if (entry.kind !== "activity" || entry.state === "failed") {
    return false;
  }

  if (entry.name === "Bash") {
    const command = commandOf(entry.input);
    return command !== null && isQuietCommand(command);
  }

  return QUIET_TOOLS.has(entry.name);
}

function sharedFolder(
  entries: readonly ActivityEntry[],
  cwd: string | null
): string | null {
  const leads = new Set<string>();

  for (const entry of entries) {
    const target = toolTargetParts(entry.input, cwd);

    if (target === null || target.kind !== "path") {
      return null;
    }

    leads.add(target.lead);
  }

  const shared = leads.size === 1 ? [...leads][0] : "";
  return shared === "" ? null : shared.slice(0, -1);
}
