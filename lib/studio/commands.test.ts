import { describe, expect, it } from "vitest";
import { commandLead, isQuietCommand } from "@/lib/studio/commands";

const CWD = "/Users/me/projects/my-video";

describe("isQuietCommand", () => {
  it("reads the project without changing it", () => {
    expect(isQuietCommand("ls src/demos/")).toBe(true);
    expect(isQuietCommand("cat package.json")).toBe(true);
    expect(isQuietCommand("grep -rln TransitionProps src/")).toBe(true);
    expect(isQuietCommand("head -60 src/demos/cat.tsx")).toBe(true);
  });

  it("stays quiet across a chain of reads", () => {
    expect(
      isQuietCommand(
        `cd ${CWD} && ls -la && echo "--- src" && find src -type f`
      )
    ).toBe(true);
  });

  it("is loud the moment one link of the chain writes", () => {
    expect(isQuietCommand(`cd ${CWD} && ls && rm -rf dist`)).toBe(false);
    expect(isQuietCommand("cat a.txt && bun add remotion")).toBe(false);
  });

  it("is loud about a redirect, wherever it hides", () => {
    expect(isQuietCommand("ls > out.txt")).toBe(false);
    expect(isQuietCommand("cat a.txt >> log")).toBe(false);
  });

  it("is loud about a substitution it cannot read into", () => {
    expect(isQuietCommand("echo $(rm -rf dist)")).toBe(false);
    expect(isQuietCommand("echo `rm -rf dist`")).toBe(false);
  });

  it("judges the body of a loop, not the loop", () => {
    expect(isQuietCommand("for f in whip-pan ripple; do ls $f; done")).toBe(
      true
    );
    expect(isQuietCommand("for d in a b; do rm -rf $d; done")).toBe(false);
  });

  it("knows which flags turn a reader into a writer", () => {
    expect(isQuietCommand("find src -name '*.tsx'")).toBe(true);
    expect(isQuietCommand("find src -name '*.tsx' -delete")).toBe(false);
    expect(isQuietCommand("find . -type f -exec rm {} ;")).toBe(false);
  });

  it("knows which half of git only looks", () => {
    expect(isQuietCommand("git status")).toBe(true);
    expect(isQuietCommand("git log --oneline -5")).toBe(true);
    expect(isQuietCommand("git checkout .")).toBe(false);
    expect(isQuietCommand("git commit -m x")).toBe(false);
  });

  it("lets curl print but not save", () => {
    expect(isQuietCommand('curl -sL "https://neon.com/"')).toBe(true);
    expect(isQuietCommand("curl -sL https://neon.com/ -o page.html")).toBe(
      false
    );
    expect(isQuietCommand("curl -sLo page.html https://neon.com/")).toBe(false);
  });

  it("is loud about a program it does not know", () => {
    expect(isQuietCommand("bun run build")).toBe(false);
    expect(isQuietCommand("sed -i s/a/b/ src/Scene.tsx")).toBe(false);
    expect(isQuietCommand("./scripts/deploy.sh")).toBe(false);
  });

  it("is not fooled by a name off Object's prototype", () => {
    expect(isQuietCommand("constructor")).toBe(false);
    expect(isQuietCommand("toString")).toBe(false);
  });

  it("gives up rather than guess when quoting hides a separator", () => {
    expect(isQuietCommand('grep "a|b" src/')).toBe(false);
  });

  it("has nothing to be quiet about in an empty command", () => {
    expect(isQuietCommand("   ")).toBe(false);
  });
});

describe("commandLead", () => {
  it("takes the cd into the open project off the front", () => {
    expect(commandLead(`cd ${CWD} && ls -la`, CWD)).toBe(`cd ${CWD} && `);
  });

  it("reads through the quotes around the folder", () => {
    expect(commandLead(`cd "${CWD}" && ls`, CWD)).toBe(`cd "${CWD}" && `);
  });

  it("does not mind a trailing separator on either side", () => {
    expect(commandLead(`cd ${CWD}/ && ls`, CWD)).toBe(`cd ${CWD}/ && `);
  });

  it("leaves a cd somewhere else alone, since that is the news", () => {
    expect(commandLead("cd /tmp && curl -sL https://neon.com/", CWD)).toBe("");
  });

  it("leaves a command that never changed folder alone", () => {
    expect(commandLead("ls -la", CWD)).toBe("");
  });

  it("has nothing to strip when the open folder is unknown", () => {
    expect(commandLead(`cd ${CWD} && ls`, null)).toBe("");
  });
});
