import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export interface Lookup {
  readonly env: string;
  readonly fallbacks: readonly string[];
  readonly name: string;
}

export interface LookupHost {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly exists: (path: string) => boolean;
}

const host: LookupHost = { env: process.env, exists: existsSync };

export const USER_BIN_DIRS = [
  ".local/bin",
  ".bun/bin",
  ".npm-global/bin",
  ".volta/bin",
  ".local/share/mise/shims",
  ".asdf/shims",
  ".local/share/pnpm",
  ".yarn/bin",
] as const;

export const SYSTEM_BIN_DIRS = ["/usr/local/bin", "/usr/bin", "/bin"] as const;

export function userBinDirs(
  home: string,
  env: Readonly<Record<string, string | undefined>> = process.env
): string[] {
  const nvm = env.NVM_BIN;
  const dirs = USER_BIN_DIRS.map((dir) => join(home, dir));

  return nvm !== undefined && nvm.length > 0 ? [...dirs, nvm] : dirs;
}

export function fallbackDirs(
  home: string,
  extra: readonly string[] = [],
  env: Readonly<Record<string, string | undefined>> = process.env
): string[] {
  return [
    ...new Set([
      ...userBinDirs(home, env),
      ...extra.map((dir) => join(home, dir)),
      ...SYSTEM_BIN_DIRS,
    ]),
  ];
}

export function findExecutable(
  lookup: Lookup,
  at: LookupHost = host
): string | null {
  const overridden = at.env[lookup.env];
  if (overridden !== undefined && overridden.length > 0) {
    return at.exists(overridden) ? overridden : null;
  }

  const onPath = (at.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir.length > 0);

  for (const dir of [...onPath, ...lookup.fallbacks]) {
    const candidate = join(dir, lookup.name);
    if (at.exists(candidate)) {
      return candidate;
    }
  }

  return null;
}
