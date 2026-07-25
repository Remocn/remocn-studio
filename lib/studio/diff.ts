export type DiffLineKind = "added" | "context" | "removed";

export interface DiffLine {
  id: number;
  kind: DiffLineKind;
  text: string;
}

type Row = Omit<DiffLine, "id">;

const MAX_CELLS = 250_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const left = lines(before);
  const right = lines(after);

  if (
    left.length === 0 ||
    right.length === 0 ||
    (left.length + 1) * (right.length + 1) > MAX_CELLS
  ) {
    return identify([...left.map(removed), ...right.map(added)]);
  }

  return identify(walk(left, right, common(left, right)));
}

function identify(rows: Row[]): DiffLine[] {
  return rows.map((row, id) => ({ ...row, id }));
}

function lines(text: string): string[] {
  return text.length === 0 ? [] : text.split("\n");
}

function added(text: string): Row {
  return { kind: "added", text };
}

function removed(text: string): Row {
  return { kind: "removed", text };
}

function common(left: string[], right: string[]): Uint32Array {
  const width = right.length + 1;
  const table = new Uint32Array((left.length + 1) * width);

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        left[i] === right[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  return table;
}

function walk(left: string[], right: string[], table: Uint32Array): Row[] {
  const width = right.length + 1;
  const rows: Row[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ kind: "context", text: left[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      rows.push(removed(left[i]));
      i += 1;
    } else {
      rows.push(added(right[j]));
      j += 1;
    }
  }

  for (let rest = i; rest < left.length; rest += 1) {
    rows.push(removed(left[rest]));
  }
  for (let rest = j; rest < right.length; rest += 1) {
    rows.push(added(right[rest]));
  }

  return rows;
}
