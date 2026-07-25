import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";

export function canonicalPath(target: string): string {
  const absolute = resolve(target);

  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

export function nameOf(path: string): string {
  const base = basename(path);
  return base.length > 0 ? base : path;
}
