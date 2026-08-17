import { describe, expect, it } from "vitest";
import {
  insertMention,
  isFolderQuery,
  isMentionPath,
  mentionAt,
  mentionOf,
  mentionPieces,
  openFolder,
  rankEntries,
  rankFiles,
  splitFolderQuery,
} from "@/lib/studio/mentions";
import type { DirectoryEntry } from "@/shared/ipc";

const FILES = [
  "package.json",
  "src/Root.tsx",
  "src/scenes/Intro.tsx",
  "src/scenes/Outro.tsx",
  "src/components/intro-title.tsx",
];

function entry(name: string, directory = false): DirectoryEntry {
  return { directory, name };
}

describe("mentionAt", () => {
  it("finds a mention being typed at the caret", () => {
    const text = "fix @Intro";
    expect(mentionAt(text, text.length)).toEqual({ query: "Intro", start: 4 });
  });

  it("finds a bare @ at the start of the text", () => {
    expect(mentionAt("@", 1)).toEqual({ query: "", start: 0 });
  });

  it("ignores an @ that follows a word, so an email is not a mention", () => {
    expect(mentionAt("write to me@example.com", 23)).toBeNull();
  });

  it("opens after a bracket", () => {
    expect(mentionAt("(@src", 5)).toEqual({ query: "src", start: 1 });
  });

  it("ends at a space for a project query", () => {
    expect(mentionAt("@Intro and", 10)).toBeNull();
  });

  it("keeps a space inside an absolute path, where folders have them", () => {
    const text = "@~/My Movies/clip";
    expect(mentionAt(text, text.length)).toEqual({
      query: "~/My Movies/clip",
      start: 0,
    });
  });

  it("stops at a backtick, so an inserted mention is not one", () => {
    const text = "see @`src/Root.tsx` ";
    expect(mentionAt(text, text.length)).toBeNull();
  });

  it("reads the mention at the caret, not the tail of the text", () => {
    const text = "@one and @two";
    expect(mentionAt(text, 4)).toEqual({ query: "one", start: 0 });
  });

  it("does not cross a line break", () => {
    expect(mentionAt("@src\nmore", 9)).toBeNull();
  });
});

describe("splitFolderQuery", () => {
  it("splits at the last slash", () => {
    expect(splitFolderQuery("/Users/me/Doc")).toEqual({
      folder: "/Users/me/",
      term: "Doc",
    });
  });

  it("treats a bare tilde as the home folder", () => {
    expect(splitFolderQuery("~")).toEqual({ folder: "~/", term: "" });
  });

  it("keeps the trailing slash as the folder itself", () => {
    expect(splitFolderQuery("~/Movies/")).toEqual({
      folder: "~/Movies/",
      term: "",
    });
  });
});

describe("isFolderQuery", () => {
  it("is true for absolute and home paths only", () => {
    expect(isFolderQuery("/Users")).toBe(true);
    expect(isFolderQuery("~/Movies")).toBe(true);
    expect(isFolderQuery("src/Root")).toBe(false);
  });
});

describe("insertMention", () => {
  it("replaces the whole @token with a backticked path", () => {
    const text = "fix @Intro";
    const mention = mentionAt(text, text.length);

    expect(
      insertMention(text, mention as never, "src/scenes/Intro.tsx")
    ).toEqual({
      caret: 27,
      text: "fix `src/scenes/Intro.tsx` ",
    });
  });

  it("keeps what was typed after the mention", () => {
    const text = "fix @Intro please";
    const mention = { query: "Intro", start: 4 };

    expect(insertMention(text, mention, "src/Intro.tsx").text).toBe(
      "fix `src/Intro.tsx` please"
    );
  });

  it("does not double the space when one is already there", () => {
    const text = "fix @Intro then";
    const mention = { query: "Intro", start: 4 };

    expect(insertMention(text, mention, "a.tsx").text).toBe("fix `a.tsx` then");
  });
});

describe("openFolder", () => {
  it("keeps the @ and drills into the folder", () => {
    const text = "@~/Mov";
    const mention = { query: "~/Mov", start: 0 };

    expect(openFolder(text, mention, "~/Movies")).toEqual({
      caret: 10,
      text: "@~/Movies/",
    });
  });
});

describe("mentionOf", () => {
  it("wraps the path in backticks", () => {
    expect(mentionOf("src/Root.tsx")).toBe("`src/Root.tsx`");
  });
});

describe("isMentionPath", () => {
  it("takes anything with a folder in it", () => {
    expect(isMentionPath("src/scenes/Intro.tsx")).toBe(true);
    expect(isMentionPath("/Users/me/My Movies/clip.mp4")).toBe(true);
  });

  it("takes a bare file name that carries an extension", () => {
    expect(isMentionPath("package.json")).toBe(true);
  });

  it("leaves an ordinary code span alone", () => {
    expect(isMentionPath("Main")).toBe(false);
    expect(isMentionPath("TransitionSeries")).toBe(false);
    expect(isMentionPath("1.5")).toBe(false);
  });

  it("wants the span to be the path and nothing else", () => {
    expect(isMentionPath(" src/Root.tsx ")).toBe(false);
    expect(isMentionPath("")).toBe(false);
  });
});

describe("mentionPieces", () => {
  it("leaves text without a backtick in one piece", () => {
    expect(mentionPieces("fix the intro")).toEqual([
      { isPath: false, start: 0, text: "fix the intro" },
    ]);
  });

  it("cuts the path out of the sentence around it", () => {
    expect(mentionPieces("fix `src/Root.tsx` please")).toEqual([
      { isPath: false, start: 0, text: "fix " },
      { isPath: true, start: 4, text: "`src/Root.tsx`" },
      { isPath: false, start: 18, text: " please" },
    ]);
  });

  it("finds every path in the message", () => {
    const pieces = mentionPieces("`a/one.tsx` and `b/two.tsx`");

    expect(
      pieces.filter((piece) => piece.isPath).map((piece) => piece.text)
    ).toEqual(["`a/one.tsx`", "`b/two.tsx`"]);
  });

  it("keeps a code span that is not a path as plain text", () => {
    expect(mentionPieces("register `Main` first")).toEqual([
      { isPath: false, start: 0, text: "register `Main` first" },
    ]);
  });

  it("does not run a path across a line break", () => {
    expect(mentionPieces("`open\nclose`").every((piece) => !piece.isPath)).toBe(
      true
    );
  });

  it("covers the whole text, in order, whatever it holds", () => {
    const text = "see `src/a.tsx`, `Main` and `~/clips/b.mp4`";
    expect(
      mentionPieces(text)
        .map((piece) => piece.text)
        .join("")
    ).toBe(text);
  });

  it("has nothing to draw for an empty message", () => {
    expect(mentionPieces("")).toEqual([]);
  });
});

describe("rankFiles", () => {
  it("returns the head of the list when nothing is typed", () => {
    expect(rankFiles(FILES, "", 2)).toEqual(["package.json", "src/Root.tsx"]);
  });

  it("prefers a match in the file name over one in the folder", () => {
    expect(rankFiles(FILES, "intro", 5)[0]).toBe("src/scenes/Intro.tsx");
  });

  it("matches a path fragment", () => {
    expect(rankFiles(FILES, "scenes/out", 5)).toEqual(["src/scenes/Outro.tsx"]);
  });

  it("matches out of order characters, but ranks them below a run", () => {
    const found = rankFiles(FILES, "intro", 5);
    expect(found).toContain("src/components/intro-title.tsx");
    expect(found.indexOf("src/scenes/Intro.tsx")).toBeLessThan(
      found.indexOf("src/components/intro-title.tsx")
    );
  });

  it("drops what does not match at all", () => {
    expect(rankFiles(FILES, "zzz", 5)).toEqual([]);
  });

  it("honours the limit", () => {
    expect(rankFiles(FILES, "s", 2)).toHaveLength(2);
  });
});

describe("rankEntries", () => {
  const entries = [
    entry("Movies", true),
    entry("Music", true),
    entry(".config", true),
    entry("notes.txt"),
  ];

  it("hides dot entries until a dot is typed", () => {
    expect(rankEntries(entries, "", 10).map((row) => row.name)).toEqual([
      "Movies",
      "Music",
      "notes.txt",
    ]);
    expect(rankEntries(entries, ".con", 10).map((row) => row.name)).toEqual([
      ".config",
    ]);
  });

  it("filters by what is typed", () => {
    expect(rankEntries(entries, "mu", 10).map((row) => row.name)).toEqual([
      "Music",
    ]);
  });
});
