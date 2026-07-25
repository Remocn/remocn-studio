import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/studio/diff";

function marked(before: string, after: string): string[] {
  const marks = { added: "+", context: " ", removed: "-" };
  return diffLines(before, after).map(
    (line) => `${marks[line.kind]}${line.text}`
  );
}

describe("diffLines", () => {
  it("reads a new file as all additions", () => {
    expect(marked("", "a\nb")).toEqual(["+a", "+b"]);
  });

  it("reads a cleared file as all removals", () => {
    expect(marked("a\nb", "")).toEqual(["-a", "-b"]);
  });

  it("keeps untouched lines as context around the change", () => {
    expect(marked("one\ntwo\nthree", "one\ndeux\nthree")).toEqual([
      " one",
      "-two",
      "+deux",
      " three",
    ]);
  });

  it("reports an insertion without touching its neighbours", () => {
    expect(marked("one\nthree", "one\ntwo\nthree")).toEqual([
      " one",
      "+two",
      " three",
    ]);
  });

  it("numbers the lines so they can be keyed", () => {
    expect(diffLines("a", "b").map((line) => line.id)).toEqual([0, 1]);
  });

  it("falls back to a coarse diff instead of a huge table", () => {
    const before = Array.from({ length: 600 }, (_, i) => `line ${i}`).join(
      "\n"
    );
    const after = `${before}\nlast`;

    const lines = diffLines(before, after);

    expect(lines).toHaveLength(1201);
    expect(lines.some((line) => line.kind === "context")).toBe(false);
  });
});
