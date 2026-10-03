import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { env } from "node:process";
import { SYSTEM_BIN_DIRS, userBinDirs } from "./agent/cli";

export const PACKAGE_MANAGERS = ["bun", "pnpm", "yarn", "npm"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const DEFAULT_MANAGER: PackageManager = "bun";

export const LOCKFILES = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
] as const satisfies readonly (readonly [string, PackageManager])[];

export interface ProjectManager {
  readonly lockfile: string | null;
  readonly manager: PackageManager;
  readonly root: string;
}

export function lockfileIn(dir: string): ProjectManager | null {
  for (const [file, manager] of LOCKFILES) {
    const lockfile = path.join(dir, file);

    if (existsSync(lockfile)) {
      return { lockfile, manager, root: dir };
    }
  }

  return null;
}

export function isWorkspaceRoot(dir: string): boolean {
  if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    return true;
  }

  try {
    const manifest = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf8")
    ) as { workspaces?: unknown };

    return manifest.workspaces !== undefined;
  } catch {
    return false;
  }
}

export function pmOf(root: string): ProjectManager {
  const own = lockfileIn(root);

  if (own !== null) {
    return own;
  }

  let dir = root;

  for (;;) {
    const parent = path.dirname(dir);

    if (parent === dir || existsSync(path.join(dir, ".git"))) {
      return { lockfile: null, manager: DEFAULT_MANAGER, root };
    }

    dir = parent;

    const found = lockfileIn(dir);

    if (found !== null) {
      return isWorkspaceRoot(dir)
        ? found
        : { lockfile: null, manager: DEFAULT_MANAGER, root };
    }
  }
}

export const INSTALL_ARGS = ["install"] as const;

export function addCommand(manager: PackageManager): string {
  return manager === "npm" ? "npm install" : `${manager} add`;
}

export function installCommand(manager: PackageManager): string {
  return `${manager} install`;
}

export function isOwnRuntime(manager: PackageManager): boolean {
  return (
    manager === "bun" &&
    typeof (process.versions as Record<string, string | undefined>).bun ===
      "string"
  );
}

export function searchDirs(): readonly string[] {
  const dirs: string[] = [];
  const home = env.HOME;

  if (home !== undefined) {
    dirs.push(...userBinDirs(home, env));
  }

  if (env.PATH !== undefined) {
    dirs.push(
      ...env.PATH.split(path.delimiter).filter((dir) => dir.length > 0)
    );
  }

  dirs.push(...SYSTEM_BIN_DIRS);

  return [...new Set(dirs)];
}

export function binaryOf(manager: PackageManager): string | null {
  if (isOwnRuntime(manager)) {
    return process.execPath;
  }

  for (const dir of searchDirs()) {
    const candidate = path.join(dir, manager);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
