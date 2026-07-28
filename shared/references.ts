const PATTERN = /\[Image #([1-9]\d*)\]/g;
const TRAILING_SPACE = /[^\S\n]$/;
const LEADING_SPACE = /^[^\S\n]/;

export interface TextSegment {
  id: string;
  kind: "text";
  start: number;
  text: string;
}

export interface ReferenceSegment {
  id: string;
  index: number;
  kind: "reference";
  start: number;
  text: string;
}

export type MessageSegment = ReferenceSegment | TextSegment;

export interface ReferenceSpan {
  end: number;
  index: number;
  start: number;
}

export function referenceOf(index: number): string {
  return `[Image #${index + 1}]`;
}

export function segmentsOf(text: string, count: number): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  if (count > 0) {
    for (const match of text.matchAll(PATTERN)) {
      const index = Number(match[1]) - 1;
      const start = match.index;

      if (index >= count) {
        continue;
      }

      if (start > cursor) {
        segments.push(textSegment(text.slice(cursor, start), cursor));
      }

      segments.push({
        id: `r${start}`,
        index,
        kind: "reference",
        start,
        text: match[0],
      });
      cursor = start + match[0].length;
    }
  }

  if (cursor < text.length) {
    segments.push(textSegment(text.slice(cursor), cursor));
  }

  return segments;
}

export function insertReferences(
  text: string,
  caret: number,
  first: number,
  count: number
): { caret: number; text: string } {
  if (count <= 0) {
    return { caret, text };
  }

  const at = Math.min(Math.max(caret, 0), text.length);
  const before = text.slice(0, at);
  const after = text.slice(at);

  const lead = before.length > 0 && !TRAILING_SPACE.test(before) ? " " : "";
  const trail = LEADING_SPACE.test(after) ? "" : " ";
  const inserted = `${lead}${references(first, count)}${trail}`;

  return { caret: at + inserted.length, text: `${before}${inserted}${after}` };
}

export function referenceAt(
  text: string,
  count: number,
  caret: number,
  forward: boolean
): ReferenceSpan | null {
  for (const segment of segmentsOf(text, count)) {
    if (segment.kind !== "reference") {
      continue;
    }

    const end = segment.start + segment.text.length;
    const touches = forward
      ? caret >= segment.start && caret < end
      : caret > segment.start && caret <= end;

    if (touches) {
      return { end, index: segment.index, start: segment.start };
    }
  }

  return null;
}

export function lostReferences(
  before: string,
  after: string,
  count: number
): number[] {
  const kept = referencedIn(after, count);

  return [...referencedIn(before, count)]
    .filter((index) => !kept.has(index))
    .sort((one, other) => one - other);
}

export function dropReference(
  text: string,
  index: number,
  count: number,
  at = -1
): { caret: number; text: string } {
  let out = "";
  let eat = false;
  let caret = -1;

  for (const segment of segmentsOf(text, count)) {
    if (segment.kind === "text") {
      out += eat ? segment.text.replace(LEADING_SPACE, "") : segment.text;
      eat = false;
      continue;
    }

    if (segment.index !== index) {
      out += referenceOf(
        segment.index < index ? segment.index : segment.index - 1
      );
      eat = false;
      continue;
    }

    const kept = out.replace(TRAILING_SPACE, "");
    eat = kept.length === out.length;
    out = kept;

    if (caret === -1 || segment.start === at) {
      caret = out.length;
    }
  }

  return { caret: caret === -1 ? out.length : caret, text: out };
}

export function dropReferences(
  text: string,
  indexes: readonly number[],
  count: number
): string {
  let out = text;
  let left = count;

  for (const index of [...indexes].sort((one, other) => other - one)) {
    out = dropReference(out, index, left).text;
    left -= 1;
  }

  return out;
}

function referencedIn(text: string, count: number): Set<number> {
  const found = new Set<number>();

  for (const segment of segmentsOf(text, count)) {
    if (segment.kind === "reference") {
      found.add(segment.index);
    }
  }

  return found;
}

function references(first: number, count: number): string {
  return Array.from({ length: count }, (_, offset) =>
    referenceOf(first + offset)
  ).join(" ");
}

function textSegment(text: string, start: number): TextSegment {
  return { id: `t${start}`, kind: "text", start, text };
}
