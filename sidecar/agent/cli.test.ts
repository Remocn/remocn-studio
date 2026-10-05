import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { missingRow as claudeMissing } from "../claude/account";
import { missingRow as codexMissing } from "../codex/account";
import { missingRow as copilotMissing } from "../copilot/account";
import { missingRow as grokMissing } from "../grok/account";
import {
  fallbackDirs,
  findExecutable,
  missingCli,
  SYSTEM_BIN_DIRS,
  USER_BIN_DIRS,
  userBinDirs,
} from "./cli";

const HOME = "/home/someone";
const SPAWN_RS = join(import.meta.dir, "../../src-tauri/src/sidecar/spawn.rs");
const HOME_BLOCK = /const HOME_BIN_DIRS[^=]*=\s*\[([^\]]*)\]/;
const SYSTEM_BLOCK = /const SYSTEM_BIN_DIRS[^=]*=\s*\[([^\]]*)\]/;
const QUOTED = /"([^"]+)"/g;

function rustList(block: RegExp): string[] | null {
  const found = readFileSync(SPAWN_RS, "utf8").match(block);

  return found === null
    ? null
    : [...(found[1] ?? "").matchAll(QUOTED)].map((match) => match[1] ?? "");
}

function hostWith(
  present: readonly string[],
  env: Record<string, string | undefined>
) {
  return { env, exists: (path: string) => present.includes(path) };
}

function lookup(name: string, extra: readonly string[] = []) {
  return {
    env: "REMOCN_STUDIO_TEST",
    fallbacks: fallbackDirs(HOME, extra, {}),
    name,
  };
}

describe("fallbackDirs", () => {
  it("finds a CLI behind mise's shims from the PATH a desktop launcher gives", () => {
    const shim = `${HOME}/.local/share/mise/shims/codex`;
    const at = hostWith([shim], { PATH: "/usr/bin:/bin" });

    expect(findExecutable(lookup("codex"), at)).toBe(shim);
  });

  it("finds a CLI in ~/.local/bin from the same minimal PATH", () => {
    const local = `${HOME}/.local/bin/claude`;
    const at = hostWith([local], { PATH: "/usr/bin:/bin" });

    expect(findExecutable(lookup("claude"), at)).toBe(local);
  });

  it("puts a CLI's own extra dir after the shared ones and the system dirs last", () => {
    const dirs = fallbackDirs(HOME, [".grok/bin"], {});

    expect(dirs.at(-SYSTEM_BIN_DIRS.length - 1)).toBe(`${HOME}/.grok/bin`);
    expect(dirs.slice(-SYSTEM_BIN_DIRS.length)).toEqual([...SYSTEM_BIN_DIRS]);
  });

  it("adds nvm's bin dir only when the environment names one", () => {
    expect(userBinDirs(HOME, {})).not.toContain("/nvm/bin");
    expect(userBinDirs(HOME, { NVM_BIN: "/nvm/bin" })).toContain("/nvm/bin");
    expect(userBinDirs(HOME, { NVM_BIN: "" })).toHaveLength(
      USER_BIN_DIRS.length
    );
  });

  it("names Homebrew and pnpm's macOS home alongside the Linux dirs", () => {
    const dirs = fallbackDirs(HOME, [], {});

    expect(dirs).toContain("/opt/homebrew/bin");
    expect(dirs).toContain(`${HOME}/Library/pnpm`);
    expect(dirs).toContain(`${HOME}/.local/share/pnpm`);
  });
});

describe("the core's list", () => {
  // The core builds the PATH the sidecar and every agent CLI inherit; when its
  // list and this one differ, a CLI is found by one side and not the other.
  it("names the same home-relative dirs as spawn.rs", () => {
    expect(rustList(HOME_BLOCK)).toEqual([...USER_BIN_DIRS]);
  });

  it("names the same system dirs as spawn.rs", () => {
    expect(rustList(SYSTEM_BLOCK)).toEqual([...SYSTEM_BIN_DIRS]);
  });
});

const ROWS = [claudeMissing(), codexMissing(), copilotMissing(), grokMissing()];

describe("missingCli", () => {
  it("fails a turn the same way on every provider, in its own words", () => {
    const results = ROWS.map((row) => missingCli(row, { sessionId: "kept" }));

    expect(new Set(results.map((result) => result.failure?.kind))).toEqual(
      new Set(["auth"])
    );
    expect(results.map((result) => result.failure?.message)).toEqual(
      ROWS.map((row) => row.detail)
    );
    expect(new Set(results.map((result) => result.failure?.message)).size).toBe(
      ROWS.length
    );
    for (const result of results) {
      expect(result.context).toBeNull();
      expect(result.sessionId).toBe("kept");
    }
  });

  it("falls back to the row's title when it carries no detail", () => {
    const result = missingCli(
      { ...claudeMissing(), detail: null },
      { sessionId: null }
    );

    expect(result.failure).toEqual({
      kind: "auth",
      message: "Claude Code is not installed",
    });
    expect(result.sessionId).toBeNull();
  });
});
