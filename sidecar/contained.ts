import { lstat, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

const HOPS = 40;

/**
 * The real path of `target`, resolved component by component the way the
 * kernel walks it — a symlink is followed before any `..` after it, and a
 * dangling link resolves to the file it would create — then joined on as
 * written from the first component that does not exist yet, so a path that is
 * about to be created still resolves.
 */
export function realPathOf(target: string): Promise<string> {
  return walk(
    sep,
    segmentsOf(isAbsolute(target) ? target : `${process.cwd()}${sep}${target}`),
    0
  );
}

async function walk(
  resolved: string,
  pending: readonly string[],
  hops: number
): Promise<string> {
  const [segment, ...rest] = pending;
  if (segment === undefined) {
    return resolved;
  }
  if (segment === "..") {
    return walk(dirname(resolved), rest, hops);
  }

  const next = join(resolved, segment);
  const link = await linkAt(next);
  if (link === MISSING || (link !== null && hops === HOPS)) {
    return resolve(next, ...rest);
  }
  if (link === null) {
    return walk(next, rest, hops);
  }

  return walk(
    isAbsolute(link) ? sep : resolved,
    [...segmentsOf(link), ...rest],
    hops + 1
  );
}

const MISSING = Symbol("missing");

async function linkAt(path: string): Promise<string | null | typeof MISSING> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink() ? await readlink(path) : null;
  } catch {
    return MISSING;
  }
}

function segmentsOf(path: string): string[] {
  return path.split(sep).filter((segment) => segment !== "" && segment !== ".");
}

export function inside(root: string, target: string): boolean {
  return (
    target === root ||
    target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
  );
}

/**
 * The first of `targets` that resolves outside every root, or `null` when all
 * of them land inside one. The permission gate turns that into a card; the
 * document reader turns it into a refusal.
 */
export async function escapee(
  cwd: string,
  extraRoots: readonly string[],
  targets: readonly string[]
): Promise<string | null> {
  if (targets.length === 0) {
    return null;
  }

  const resolved = await Promise.all([
    realPathOf(cwd),
    ...extraRoots.map((root) => realPathOf(root)),
    ...targets.map((target) =>
      realPathOf(isAbsolute(target) ? target : `${cwd}${sep}${target}`)
    ),
  ]);

  const roots = resolved.slice(0, 1 + extraRoots.length);
  return (
    resolved
      .slice(1 + extraRoots.length)
      .find((target) => !roots.some((root) => inside(root, target))) ?? null
  );
}
