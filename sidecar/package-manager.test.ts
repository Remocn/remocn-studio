import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addCommand,
  binaryOf,
  installCommand,
  isOwnRuntime,
  lockfileIn,
  pmOf,
  searchDirs,
} from "./package-manager";

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-pm-"));
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

const write = async (file: string, body: unknown) => {
  const target = path.join(folder, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(body));
};

const touch = async (file: string) => {
  const target = path.join(folder, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "");
};

describe("lockfileIn", () => {
  const table = [
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
  ] as const;

  for (const [file, manager] of table) {
    it(`reads ${file} as ${manager}`, async () => {
      await touch(file);

      expect(lockfileIn(folder)).toMatchObject({
        lockfile: path.join(folder, file),
        manager,
      });
    });
  }

  it("is null with no lockfile at all", () => {
    expect(lockfileIn(folder)).toBeNull();
  });

  it("is deterministic when two lockfiles sit in one folder", async () => {
    await touch("package-lock.json");
    await touch("bun.lock");

    expect(lockfileIn(folder)?.manager).toBe("bun");
  });
});

describe("pmOf", () => {
  it("defaults to bun when nothing names a manager", () => {
    expect(pmOf(folder)).toEqual({
      lockfile: null,
      manager: "bun",
      root: folder,
    });
  });

  it("takes the lockfile of the folder itself", async () => {
    await touch("package-lock.json");

    expect(pmOf(folder).manager).toBe("npm");
  });

  it("finds a workspace lockfile above the project", async () => {
    const project = path.join(folder, "packages/video");
    await mkdir(project, { recursive: true });
    await touch("pnpm-workspace.yaml");
    await touch("pnpm-lock.yaml");

    expect(pmOf(project)).toMatchObject({
      lockfile: path.join(folder, "pnpm-lock.yaml"),
      manager: "pnpm",
      root: folder,
    });
  });

  it("reads workspaces out of the enclosing package.json too", async () => {
    const project = path.join(folder, "packages/video");
    await mkdir(project, { recursive: true });
    await write("package.json", { workspaces: ["packages/*"] });
    await touch("yarn.lock");

    expect(pmOf(project).manager).toBe("yarn");
  });

  it("does not inherit the manager of a repo that merely encloses the folder", async () => {
    const project = path.join(folder, "somewhere/video");
    await mkdir(project, { recursive: true });
    await write("package.json", { name: "unrelated" });
    await touch("package-lock.json");

    expect(pmOf(project)).toMatchObject({ lockfile: null, manager: "bun" });
  });

  it("stops climbing at the repository root", async () => {
    const project = path.join(folder, "repo/packages/video");
    await mkdir(project, { recursive: true });
    await touch("repo/.git");
    await write("package.json", { workspaces: ["repo/*"] });
    await touch("yarn.lock");

    expect(pmOf(project)).toMatchObject({ lockfile: null, manager: "bun" });
  });

  it("still reads a lockfile that sits beside .git", async () => {
    const project = path.join(folder, "repo/packages/video");
    await mkdir(project, { recursive: true });
    await touch("repo/.git");
    await write("repo/package.json", { workspaces: ["packages/*"] });
    await touch("repo/package-lock.json");

    expect(pmOf(project).manager).toBe("npm");
  });

  it("reports the nearest lockfile, not the outermost", async () => {
    const project = path.join(folder, "packages/video");
    await mkdir(project, { recursive: true });
    await write("package.json", { workspaces: ["packages/*"] });
    await touch("yarn.lock");
    await touch("packages/video/package-lock.json");

    expect(pmOf(project).manager).toBe("npm");
  });
});

describe("commands", () => {
  it("spells adding a package per manager", () => {
    expect(addCommand("bun")).toBe("bun add");
    expect(addCommand("pnpm")).toBe("pnpm add");
    expect(addCommand("yarn")).toBe("yarn add");
    expect(addCommand("npm")).toBe("npm install");
  });

  it("spells installing per manager", () => {
    expect(installCommand("npm")).toBe("npm install");
    expect(installCommand("bun")).toBe("bun install");
  });
});

describe("binaryOf", () => {
  it("uses the sidecar's own runtime for bun, and only for bun", () => {
    if (isOwnRuntime("bun")) {
      expect(binaryOf("bun")).toBe(process.execPath);
    }

    expect(binaryOf("npm")).not.toBe(process.execPath);
  });

  it("answers with an absolute path, or nothing at all", () => {
    const found = binaryOf("npm");

    if (found !== null) {
      expect(path.isAbsolute(found)).toBe(true);
      expect(existsSync(found)).toBe(true);
    }
  });
});

describe("searchDirs", () => {
  const HOME = "/home/someone";

  it("keeps the managers' own dirs ahead of PATH and the shared dirs after the system ones", () => {
    const dirs = searchDirs({ HOME, PATH: "/usr/bin:/custom/bin" });
    const at = (dir: string) => dirs.indexOf(dir);

    expect(dirs.slice(0, 5)).toEqual([
      `${HOME}/.bun/bin`,
      `${HOME}/.volta/bin`,
      `${HOME}/.yarn/bin`,
      `${HOME}/Library/pnpm`,
      `${HOME}/.local/share/pnpm`,
    ]);
    expect(dirs[5]).toBe("/usr/bin");
    expect(dirs[6]).toBe("/custom/bin");
    expect(at("/opt/homebrew/bin")).toBeLessThan(
      at(`${HOME}/.local/share/mise/shims`)
    );
    expect(at("/usr/local/bin")).toBeLessThan(at(`${HOME}/.asdf/shims`));
    expect(at("/usr/sbin")).toBeLessThan(at(`${HOME}/.local/bin`));
  });

  it("names each dir once", () => {
    const dirs = searchDirs({ HOME, PATH: `${HOME}/.bun/bin:/usr/bin` });

    expect(new Set(dirs).size).toBe(dirs.length);
  });
});
