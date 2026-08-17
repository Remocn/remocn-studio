import { baseName } from "@/lib/studio/paths";
import type { DirectoryEntry } from "@/shared/ipc";

export interface Mention {
  query: string;
  start: number;
}

export interface FolderQuery {
  folder: string;
  term: string;
}

export interface MentionEdit {
  caret: number;
  text: string;
}

export interface MentionPiece {
  isPath: boolean;
  start: number;
  text: string;
}

const OPENERS = new Set(["(", "[", "{", "'", '"', "«"]);

const LEADING_SPACE = /^[^\S\n]/;

const QUOTED = /`([^`\n]+)`/g;

const NAMED_FILE = /^[^\s/\\]+\.[A-Za-z][A-Za-z\d]{0,9}$/;

const MAX_QUERY = 200;

export function mentionAt(text: string, caret: number): Mention | null {
  const at = Math.min(Math.max(caret, 0), text.length);
  const start = text.lastIndexOf("@", at - 1);

  if (start === -1 || at - start > MAX_QUERY) {
    return null;
  }

  const before = start === 0 ? "" : text[start - 1];
  if (before !== "" && !(isBlank(before) || OPENERS.has(before))) {
    return null;
  }

  const query = text.slice(start + 1, at);

  if (query.includes("`") || query.includes("\n")) {
    return null;
  }

  if (query.includes(" ") && !isFolderQuery(query)) {
    return null;
  }

  return { query, start };
}

export function isFolderQuery(query: string): boolean {
  return query.startsWith("/") || query.startsWith("~");
}

export function splitFolderQuery(query: string): FolderQuery {
  const cut = query.lastIndexOf("/");

  if (cut === -1) {
    return { folder: `${query}/`, term: "" };
  }

  return { folder: query.slice(0, cut + 1), term: query.slice(cut + 1) };
}

export function mentionOf(path: string): string {
  return `\`${path}\``;
}

export function insertMention(
  text: string,
  mention: Mention,
  path: string
): MentionEdit {
  const after = text.slice(mention.start + 1 + mention.query.length);
  const written = `${mentionOf(path)}${LEADING_SPACE.test(after) ? "" : " "}`;

  return {
    caret: mention.start + written.length,
    text: `${text.slice(0, mention.start)}${written}${after}`,
  };
}

export function openFolder(
  text: string,
  mention: Mention,
  folder: string
): MentionEdit {
  const written = `@${folder.endsWith("/") ? folder : `${folder}/`}`;
  const after = text.slice(mention.start + 1 + mention.query.length);

  return {
    caret: mention.start + written.length,
    text: `${text.slice(0, mention.start)}${written}${after}`,
  };
}

export function isMentionPath(inside: string): boolean {
  return (
    inside.trim() === inside &&
    inside !== "" &&
    (inside.includes("/") || NAMED_FILE.test(inside))
  );
}

export function mentionPieces(text: string): MentionPiece[] {
  if (!text.includes("`")) {
    return text === "" ? [] : [{ isPath: false, start: 0, text }];
  }

  const pieces: MentionPiece[] = [];
  let cursor = 0;

  for (const match of text.matchAll(QUOTED)) {
    if (!isMentionPath(match[1])) {
      continue;
    }

    const at = match.index;
    if (at > cursor) {
      pieces.push({
        isPath: false,
        start: cursor,
        text: text.slice(cursor, at),
      });
    }

    pieces.push({ isPath: true, start: at, text: match[0] });
    cursor = at + match[0].length;
  }

  if (cursor < text.length) {
    pieces.push({ isPath: false, start: cursor, text: text.slice(cursor) });
  }

  return pieces;
}

export function rankFiles(
  files: readonly string[],
  term: string,
  limit: number
): string[] {
  if (term === "") {
    return files.slice(0, limit);
  }

  const needle = term.toLowerCase();
  const scored: { path: string; score: number }[] = [];

  for (const path of files) {
    const score = scoreOf(path, needle);
    if (score !== null) {
      scored.push({ path, score });
    }
  }

  scored.sort(
    (one, other) =>
      other.score - one.score || one.path.localeCompare(other.path)
  );

  return scored.slice(0, limit).map((row) => row.path);
}

export function rankEntries(
  entries: readonly DirectoryEntry[],
  term: string,
  limit: number
): DirectoryEntry[] {
  const needle = term.toLowerCase();
  const hidden = needle.startsWith(".");

  const kept = entries.filter((entry) => {
    if (!hidden && entry.name.startsWith(".")) {
      return false;
    }
    return needle === "" || entry.name.toLowerCase().includes(needle);
  });

  if (needle === "") {
    return kept.slice(0, limit);
  }

  kept.sort((one, other) => {
    const first = one.name.toLowerCase().indexOf(needle);
    const second = other.name.toLowerCase().indexOf(needle);
    return first - second || one.name.localeCompare(other.name);
  });

  return kept.slice(0, limit);
}

function scoreOf(path: string, needle: string): number | null {
  const lowered = path.toLowerCase();
  const name = baseName(lowered);

  const inName = spanOf(name, needle);
  if (inName !== null) {
    return (
      1000 +
      (name.startsWith(needle) ? 200 : 0) -
      inName.start -
      (inName.end - inName.start - needle.length) * 3 -
      path.length / 100
    );
  }

  const inPath = spanOf(lowered, needle);
  if (inPath === null) {
    return null;
  }

  return (
    500 -
    inPath.start / 10 -
    (inPath.end - inPath.start - needle.length) * 3 -
    path.length / 100
  );
}

function spanOf(
  haystack: string,
  needle: string
): { end: number; start: number } | null {
  const direct = haystack.indexOf(needle);
  if (direct !== -1) {
    return { end: direct + needle.length, start: direct };
  }

  let start = -1;
  let end = -1;
  let index = 0;

  for (let at = 0; at < haystack.length && index < needle.length; at += 1) {
    if (haystack[at] !== needle[index]) {
      continue;
    }
    if (index === 0) {
      start = at;
    }
    end = at + 1;
    index += 1;
  }

  return index === needle.length ? { end, start } : null;
}

function isBlank(character: string): boolean {
  return character.trim() === "";
}
