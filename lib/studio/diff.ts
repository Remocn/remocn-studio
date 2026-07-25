import { type ArrayChange, diffArrays } from "diff";

export type DiffLineKind = "added" | "context" | "removed";

export interface DiffLine {
  id: number;
  kind: DiffLineKind;
  text: string;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const rows: DiffLine[] = [];

  for (const change of diffArrays(lines(before), lines(after))) {
    const kind = kindOf(change);
    for (const text of change.value) {
      rows.push({ id: rows.length, kind, text });
    }
  }

  return rows;
}

function kindOf(change: ArrayChange<string>): DiffLineKind {
  if (change.added) {
    return "added";
  }

  if (change.removed) {
    return "removed";
  }

  return "context";
}

function lines(text: string): string[] {
  return text.length === 0 ? [] : text.split("\n");
}
