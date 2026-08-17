import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  DirectoryEntry,
  DirectoryListing,
  ProjectFiles,
} from "@/shared/ipc";

export class FilesError extends Data.TaggedError("FilesError")<{
  message: string;
}> {}

export const MAX_PROJECT_FILES = 4000;

const MAX_DEPTH = 12;

const SKIPPED_DIRECTORIES = new Set([
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "tmp",
]);

interface Walked {
  files: string[];
  truncated: boolean;
}

export function walkProject(root: string, limit = MAX_PROJECT_FILES): Walked {
  const files: string[] = [];
  let truncated = false;

  const descend = (dir: string, depth: number) => {
    if (truncated || depth > MAX_DEPTH) {
      return;
    }

    for (const entry of readableEntriesIn(path.join(root, dir))) {
      if (isSkipped(entry)) {
        continue;
      }

      const relative = dir === "" ? entry.name : `${dir}/${entry.name}`;

      if (entry.directory) {
        descend(relative, depth + 1);
        continue;
      }

      if (files.length >= limit) {
        truncated = true;
        return;
      }

      files.push(relative);
    }
  };

  descend("", 0);
  files.sort(byPath);

  return { files, truncated };
}

export function projectFiles(
  root: string,
  limit = MAX_PROJECT_FILES
): Effect.Effect<ProjectFiles, FilesError> {
  return Effect.try({
    catch: (cause) => new FilesError({ message: errorMessage(cause) }),
    try: () => ({ ...walkProject(root, limit), root }),
  });
}

export function resolveFolder(input: string, home = homedir()): string {
  const trimmed = input.trim();
  const expanded =
    trimmed === "~" || trimmed.startsWith("~/")
      ? path.join(home, trimmed.slice(1))
      : trimmed;

  return path.resolve(expanded === "" ? home : expanded);
}

export function readFolder(input: string): DirectoryListing {
  const resolved = resolveFolder(input);
  const entries = entriesIn(resolved);

  entries.sort(byKind);

  return { entries, path: resolved };
}

export function listFolder(
  input: string
): Effect.Effect<DirectoryListing, FilesError> {
  return Effect.try({
    catch: (cause) =>
      new FilesError({
        message: `${input} could not be listed: ${errorMessage(cause)}`,
      }),
    try: () => readFolder(input),
  });
}

function isSkipped(entry: DirectoryEntry): boolean {
  return (
    entry.name.startsWith(".") ||
    (entry.directory && SKIPPED_DIRECTORIES.has(entry.name))
  );
}

function readableEntriesIn(dir: string): DirectoryEntry[] {
  try {
    return entriesIn(dir);
  } catch {
    return [];
  }
}

function entriesIn(dir: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "") {
      continue;
    }

    entries.push({
      directory: entry.isSymbolicLink()
        ? linksToFolder(path.join(dir, entry.name))
        : entry.isDirectory(),
      name: entry.name,
    });
  }

  return entries;
}

function linksToFolder(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function byPath(one: string, other: string): number {
  return one.localeCompare(other, undefined, { sensitivity: "base" });
}

function byKind(one: DirectoryEntry, other: DirectoryEntry): number {
  if (one.directory !== other.directory) {
    return one.directory ? -1 : 1;
  }
  return byPath(one.name, other.name);
}
