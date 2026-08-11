const WEAK = /^W\//;

export interface Versioned {
  mtimeMs: number;
  size: number;
}

export function etagOf(file: Versioned): string {
  const stamp = Math.floor(file.mtimeMs).toString(16);

  return `"${file.size.toString(16)}-${stamp}"`;
}

export function matches(header: string | undefined, tag: string): boolean {
  if (header === undefined) {
    return false;
  }

  return header.split(",").some((candidate) => is(candidate.trim(), tag));
}

function is(candidate: string, tag: string): boolean {
  return candidate === "*" || candidate.replace(WEAK, "") === tag;
}
