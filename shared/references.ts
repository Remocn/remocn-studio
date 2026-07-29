const PATTERN = /\[(Element|Image) #([1-9]\d*)\]/g;
const TRAILING_SPACE = /[^\S\n]$/;
const LEADING_SPACE = /^[^\S\n]/;

export const REFERENCE_KINDS = ["element", "image"] as const;

export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export type ReferenceCounts = Readonly<Record<ReferenceKind, number>>;

export const NO_REFERENCES: ReferenceCounts = { element: 0, image: 0 };

const LABELS: Record<ReferenceKind, string> = {
  element: "Element",
  image: "Image",
};

const KINDS = new Map<string, ReferenceKind>(
  REFERENCE_KINDS.map((kind) => [LABELS[kind], kind])
);

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
  reference: ReferenceKind;
  start: number;
  text: string;
}

export type MessageSegment = ReferenceSegment | TextSegment;

export interface ReferenceSpan {
  end: number;
  index: number;
  reference: ReferenceKind;
  start: number;
}

export type LostReferences = Readonly<Record<ReferenceKind, number[]>>;

export function referenceOf(kind: ReferenceKind, index: number): string {
  return `[${LABELS[kind]} #${index + 1}]`;
}

export function countsOf(counts: Partial<ReferenceCounts>): ReferenceCounts {
  return { ...NO_REFERENCES, ...counts };
}

export function segmentsOf(
  text: string,
  counts: ReferenceCounts
): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PATTERN)) {
    const reference = KINDS.get(match[1]);
    const index = Number(match[2]) - 1;
    const start = match.index;

    if (reference === undefined || index >= counts[reference]) {
      continue;
    }

    if (start > cursor) {
      segments.push(textSegment(text.slice(cursor, start), cursor));
    }

    segments.push({
      id: `r${start}`,
      index,
      kind: "reference",
      reference,
      start,
      text: match[0],
    });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push(textSegment(text.slice(cursor), cursor));
  }

  return segments;
}

export function insertAt(
  text: string,
  caret: number,
  written: string
): { caret: number; text: string } {
  if (written.length === 0) {
    return { caret, text };
  }

  const at = Math.min(Math.max(caret, 0), text.length);
  const before = text.slice(0, at);
  const after = text.slice(at);

  const lead = before.length > 0 && !TRAILING_SPACE.test(before) ? " " : "";
  const trail = LEADING_SPACE.test(after) ? "" : " ";
  const inserted = `${lead}${written}${trail}`;

  return { caret: at + inserted.length, text: `${before}${inserted}${after}` };
}

export function insertReferences(
  text: string,
  caret: number,
  kind: ReferenceKind,
  first: number,
  count: number
): { caret: number; text: string } {
  return count <= 0
    ? { caret, text }
    : insertAt(text, caret, references(kind, first, count));
}

export function referenceAt(
  text: string,
  counts: ReferenceCounts,
  caret: number,
  forward: boolean
): ReferenceSpan | null {
  for (const segment of segmentsOf(text, counts)) {
    if (segment.kind !== "reference") {
      continue;
    }

    const end = segment.start + segment.text.length;
    const touches = forward
      ? caret >= segment.start && caret < end
      : caret > segment.start && caret <= end;

    if (touches) {
      return {
        end,
        index: segment.index,
        reference: segment.reference,
        start: segment.start,
      };
    }
  }

  return null;
}

export function lostReferences(
  before: string,
  after: string,
  counts: ReferenceCounts
): LostReferences {
  const kept = referencedIn(after, counts);
  const held = referencedIn(before, counts);

  const gone = (kind: ReferenceKind) =>
    [...held[kind]]
      .filter((index) => !kept[kind].has(index))
      .sort((one, other) => one - other);

  return { element: gone("element"), image: gone("image") };
}

export function hasLostReferences(lost: LostReferences): boolean {
  return REFERENCE_KINDS.some((kind) => lost[kind].length > 0);
}

export function dropReference(
  text: string,
  kind: ReferenceKind,
  index: number,
  counts: ReferenceCounts,
  at = -1
): { caret: number; text: string } {
  let out = "";
  let eat = false;
  let caret = -1;

  for (const segment of segmentsOf(text, counts)) {
    if (segment.kind === "text") {
      out += eat ? segment.text.replace(LEADING_SPACE, "") : segment.text;
      eat = false;
      continue;
    }

    if (segment.reference !== kind || segment.index !== index) {
      out +=
        segment.reference === kind && segment.index > index
          ? referenceOf(kind, segment.index - 1)
          : segment.text;
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
  kind: ReferenceKind,
  indexes: readonly number[],
  counts: ReferenceCounts
): string {
  let out = text;
  let left = counts[kind];

  for (const index of [...indexes].sort((one, other) => other - one)) {
    out = dropReference(out, kind, index, { ...counts, [kind]: left }).text;
    left -= 1;
  }

  return out;
}

export function dropLostReferences(
  text: string,
  lost: LostReferences,
  counts: ReferenceCounts
): string {
  let out = text;
  let left = counts;

  for (const kind of REFERENCE_KINDS) {
    out = dropReferences(out, kind, lost[kind], left);
    left = { ...left, [kind]: left[kind] - lost[kind].length };
  }

  return out;
}

function referencedIn(
  text: string,
  counts: ReferenceCounts
): Readonly<Record<ReferenceKind, Set<number>>> {
  const found = { element: new Set<number>(), image: new Set<number>() };

  for (const segment of segmentsOf(text, counts)) {
    if (segment.kind === "reference") {
      found[segment.reference].add(segment.index);
    }
  }

  return found;
}

function references(kind: ReferenceKind, first: number, count: number): string {
  return Array.from({ length: count }, (_, offset) =>
    referenceOf(kind, first + offset)
  ).join(" ");
}

function textSegment(text: string, start: number): TextSegment {
  return { id: `t${start}`, kind: "text", start, text };
}
