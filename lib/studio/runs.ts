import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";

export type TranscriptItem =
  | { entry: TranscriptEntry; id: string; kind: "entry" }
  | { entries: readonly ActivityEntry[]; id: string; kind: "run" };

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
    if (isFoldable(entry)) {
      run.push(entry);
      continue;
    }

    settle();
    items.push({ entry, id: entry.id, kind: "entry" });
  }

  settle();

  return items;
}

function isFoldable(entry: TranscriptEntry): entry is ActivityEntry {
  return entry.kind === "activity" && entry.state !== "failed";
}
