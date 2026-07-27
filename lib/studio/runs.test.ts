import { describe, expect, it } from "vitest";
import { groupActivity, runSummary } from "@/lib/studio/runs";
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
  return groupActivity(entries).flatMap((item) =>
    item.kind === "run" ? ids(item.entries) : [item.entry.id]
  );
}

describe("groupActivity", () => {
  it("folds consecutive reads into one run, keyed by the first of them", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      read("b", "src/B.tsx"),
      read("c", "src/C.tsx"),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
    expect(items[0].id).toBe("a");
  });

  it("never folds a write away, and does not merge across it", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      read("b", "src/B.tsx"),
      activity({ id: "w", name: "Write" }),
      read("c", "src/C.tsx"),
      read("d", "src/D.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["run", "entry", "run"]);
    expect(ids(items)).toEqual(["a", "w", "c"]);
  });

  it("never folds a command that changed something", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      activity({ id: "sh", input: { command: "bun run build" }, name: "Bash" }),
      read("b", "src/B.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["entry", "entry", "entry"]);
  });

  it("folds a command that only looked, since it did nothing", () => {
    const items = groupActivity([
      shell("one", `cd ${CWD} && ls -la`),
      shell("two", "cat package.json"),
      shell("three", "grep -rln TransitionProps src/"),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
  });

  it("breaks a run of reads on the one command that wrote", () => {
    const items = groupActivity([
      shell("one", "ls src/"),
      shell("two", "cat package.json"),
      shell("gone", "rm -rf dist"),
      shell("three", "ls src/"),
      shell("four", "cat package.json"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["run", "entry", "run"]);
    expect(ids(items)).toEqual(["one", "gone", "three"]);
  });

  it("folds a shell read next to a Read, since neither changed anything", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      shell("one", "ls src/"),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
  });

  it("leaves a failed read on screen rather than inside a run", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      activity({ id: "bad", state: "failed" }),
      read("b", "src/B.tsx"),
      read("c", "src/C.tsx"),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["entry", "entry", "run"]);
    expect(ids(items)).toEqual(["a", "bad", "b"]);
  });

  it("leaves a lone read a plain row", () => {
    const items = groupActivity([read("a", "src/A.tsx")]);

    expect(items).toEqual([
      { entry: read("a", "src/A.tsx"), id: "a", kind: "entry" },
    ]);
  });

  it("folds a run of different quiet tools together", () => {
    const items = groupActivity([
      read("a", "src/A.tsx"),
      activity({
        id: "g",
        input: { pattern: "useCurrentFrame" },
        name: "Grep",
      }),
      activity({ id: "b", input: { pattern: "**/*.tsx" }, name: "Glob" }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("run");
  });

  it("never folds a tool it does not recognise", () => {
    const items = groupActivity([
      activity({ id: "x", name: "SomeNewTool" }),
      activity({ id: "y", name: "SomeNewTool" }),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["entry", "entry"]);
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
      { attachments: [], id: "user-0", kind: "user", text: "go" },
      read("a", "src/A.tsx"),
      read("b", "src/B.tsx"),
      activity({ id: "w", name: "Write" }),
      read("c", "src/C.tsx"),
      { id: "assistant-0", kind: "assistant", text: "done" },
    ];

    expect(flatten(entries)).toEqual(entries.map((entry) => entry.id));
  });
});

describe("runSummary", () => {
  it("counts the files and names the folder they share", () => {
    const summary = runSummary(
      [
        read("a", "components/studio/composer.tsx"),
        read("b", "components/studio/transcript.tsx"),
      ],
      CWD
    );

    expect(summary.text).toBe("Read 2 files in components/studio");
    expect(summary.name).toBe("Read");
  });

  it("only counts when the run is spread over several folders", () => {
    const summary = runSummary(
      [read("a", "components/composer.tsx"), read("b", "hooks/use-turns.ts")],
      CWD
    );

    expect(summary.text).toBe("Read 2 files");
  });

  it("says nothing about a folder for files at the root of the project", () => {
    const summary = runSummary(
      [read("a", "package.json"), read("b", "remotion.config.ts")],
      CWD
    );

    expect(summary.text).toBe("Read 2 files");
  });

  it("uses the noun of the tool that ran", () => {
    const summary = runSummary(
      [
        activity({ id: "a", input: { pattern: "one" }, name: "Grep" }),
        activity({ id: "b", input: { pattern: "two" }, name: "Grep" }),
      ],
      CWD
    );

    expect(summary.text).toBe("Grep 2 searches");
  });

  it("counts a run of shell reads as commands", () => {
    const summary = runSummary(
      [shell("one", "ls src/"), shell("two", "cat package.json")],
      CWD
    );

    expect(summary.text).toBe("Bash 2 commands");
  });

  it("stays neutral about a run of mixed tools", () => {
    const summary = runSummary(
      [
        read("a", "src/A.tsx"),
        activity({ id: "b", input: { pattern: "one" }, name: "Grep" }),
      ],
      CWD
    );

    expect(summary.text).toBe("Explored 2 items");
  });
});
