import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fallbackDirs,
  findExecutable,
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

  it("names no macOS-only location", () => {
    const dirs = fallbackDirs(HOME, [], {});

    expect(dirs.some((dir) => dir.includes("homebrew"))).toBe(false);
    expect(dirs.some((dir) => dir.includes("Library"))).toBe(false);
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
