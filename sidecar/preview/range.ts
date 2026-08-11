export interface ByteRange {
  end: number;
  start: number;
}

export const UNSATISFIABLE = "unsatisfiable";

const BYTES = /^bytes\s*=\s*(.+)$/i;
const DIGITS = /^\d+$/;

export function byteRange(
  header: string | undefined,
  size: number
): ByteRange | typeof UNSATISFIABLE | null {
  if (header === undefined) {
    return null;
  }

  const match = BYTES.exec(header.trim());

  if (match === null) {
    return null;
  }

  const specs = match[1].split(",");

  if (specs.length !== 1) {
    return null;
  }

  const spec = specs[0].trim();
  const dash = spec.indexOf("-");

  if (dash === -1) {
    return null;
  }

  const from = spec.slice(0, dash).trim();
  const to = spec.slice(dash + 1).trim();

  if (from.length === 0) {
    return suffix(to, size);
  }

  if (!DIGITS.test(from) || (to.length > 0 && !DIGITS.test(to))) {
    return null;
  }

  const start = Number(from);

  if (start >= size) {
    return UNSATISFIABLE;
  }

  const end = to.length === 0 ? size - 1 : Math.min(Number(to), size - 1);

  return end < start ? UNSATISFIABLE : { end, start };
}

function suffix(
  to: string,
  size: number
): ByteRange | typeof UNSATISFIABLE | null {
  if (!DIGITS.test(to)) {
    return null;
  }

  const length = Number(to);

  if (length === 0 || size === 0) {
    return UNSATISFIABLE;
  }

  return { end: size - 1, start: Math.max(0, size - length) };
}
