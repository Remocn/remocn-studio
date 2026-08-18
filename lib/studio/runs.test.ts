import { describe, expect, it } from "vitest";
import { groupActivity } from "@/lib/studio/runs";
import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";

const CWD = "/Users/me/projects/my-video";

function read(id: string, file: string): ActivityEntry {
  return {
    id,
    input: { file_path: `${CWD}/${file}` },
    kind: "activity",
    name: "Read",
    result: "…",
    state: "done",
    verb: null,
  };
}

function activity(shape: Partial<ActivityEntry>): ActivityEntry {
  return { ...read("t", "src/Scene.tsx"), ...shape };
}

function shell(id: string, command: string): ActivityEntry {
  return activity({ id, input: { command }, name: "Bash" });
}

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

function flatten(entries: readonly TranscriptEntry[]): string[] {
  return groupActivity(entries).flatMap((item) => {
    if (item.kind === "run") {
      return ids(item.entries);
    }

    return item.kind === "tasks" ? [] : [item.entry.id];
  });
}

describe("groupActivity", () => {
  it("folds consecutive calls into one run, keyed by the first of them", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      read("b", "src/B.tsx"),
      read("c", "src/C.tsx"),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
    expect(items[0].id).toBe("a");
  });

  it("folds whatever the tools were, since the run shows the last of them", () => {
    const items = groupActivity([
      shell("one", "bun run build"),
      activity({ id: "w", name: "Write" }),
      read("b", "src/B.tsx"),
      activity({ id: "e", name: "Edit" }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
  });

  it("leaves a failed call on screen rather than inside a run", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      activity({ id: "bad", state: "failed" }),
      read("b", "src/B.tsx"),
      read("c", "src/C.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["entry", "entry", "run"]);
    expect(ids(items)).toEqual(["a", "bad", "b"]);
  });

  it("leaves a lone call a plain row", () => {
    const items = groupActivity([read("a", "src/A.tsx")]);

    expect(items).toEqual([
      { entry: read("a", "src/A.tsx"), id: "a", kind: "entry" },
    ]);
  });

  it("breaks a run on anything that is not a tool call", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      { id: "assistant-0", kind: "assistant", text: "Looking…" },
      read("b", "src/B.tsx"),
      { id: "notice-0", kind: "notice", text: "denied" },
      read("c", "src/C.tsx"),
      read("d", "src/D.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual([
      "entry",
      "entry",
      "entry",
      "entry",
      "run",
    ]);
  });

  it("groups a session loaded from history exactly as a live one", () => {
    const live = [read("toolu_01", "src/A.tsx"), read("toolu_02", "src/B.tsx")];
    const stored = [read("block-3", "src/A.tsx"), read("block-4", "src/B.tsx")];

    expect(groupActivity(live).map((item) => item.kind)).toEqual(
      groupActivity(stored).map((item) => item.kind)
    );
  });

  it("preserves the order of the transcript exactly", () => {
    const entries: TranscriptEntry[] = [
      {
        assets: [],
        attachments: [],
        elements: [],
        id: "user-0",
        kind: "user",
        media: [],
        text: "go",
      },
      read("a", "src/A.tsx"),
      read("b", "src/B.tsx"),
      activity({ id: "w", name: "Write" }),
      read("c", "src/C.tsx"),
      { id: "assistant-0", kind: "assistant", text: "done" },
    ];

    expect(flatten(entries)).toEqual(entries.map((entry) => entry.id));
  });
});
