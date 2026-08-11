// @vitest-environment node

import { describe, expect, it } from "vitest";
import { etagOf, matches } from "./caching";

const FILE = { mtimeMs: 1_760_000_000_123.4, size: 15_515_928 };
const QUOTED = /^"[\da-f]+-[\da-f]+"$/;

describe("etagOf", () => {
  it("changes when the agent rewrites the file", () => {
    expect(etagOf(FILE)).not.toBe(
      etagOf({ ...FILE, mtimeMs: FILE.mtimeMs + 1 })
    );
    expect(etagOf(FILE)).not.toBe(etagOf({ ...FILE, size: FILE.size + 1 }));
  });

  it("stays the same for a file nobody touched", () => {
    expect(etagOf(FILE)).toBe(etagOf({ ...FILE }));
  });

  it("is quoted, as the header requires", () => {
    expect(etagOf(FILE)).toMatch(QUOTED);
  });
});

describe("matches", () => {
  const tag = etagOf(FILE);

  it("says no when nothing was asked", () => {
    expect(matches(undefined, tag)).toBe(false);
  });

  it("recognises the tag it handed out", () => {
    expect(matches(tag, tag)).toBe(true);
  });

  it("finds the tag in a list", () => {
    expect(matches(`"other", ${tag} , "third"`, tag)).toBe(true);
  });

  it("accepts the weak form of its own tag", () => {
    expect(matches(`W/${tag}`, tag)).toBe(true);
  });

  it("treats a wildcard as a match, since the file exists", () => {
    expect(matches("*", tag)).toBe(true);
  });

  it("says no to a tag from a file that has changed", () => {
    expect(matches('"deadbeef-1"', tag)).toBe(false);
  });
});
