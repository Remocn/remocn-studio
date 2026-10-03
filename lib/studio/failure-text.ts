export interface WordedFailure {
  details: string | null;
  sentence: string;
}

const ERROR_PREFIX = /^(?:[A-Z][A-Za-z]*)?Error:\s*/;
const NAMED_ERROR = /^[A-Z][A-Za-z]*Error:/;
const ENGINE =
  /cannot read propert(?:y|ies) of|is not a function|is not defined\b|is not iterable|is not an object|is not a constructor|maximum call stack size|unexpected token|cannot access '[^']*' before initialization/i;
const STRUCTURED = /^[[{<]|^at\s/;
const LONGEST_SENTENCE = 280;
const SPACE = /\s/;
const LINES = /\r?\n/;

const KNOWN: readonly { pattern: RegExp; sentence: string }[] = [
  {
    pattern: /\bENOENT\b|no such file or directory/i,
    sentence: "A file it needed could not be found.",
  },
  {
    pattern: /\bE(?:ACCES|PERM)\b|permission denied|operation not permitted/i,
    sentence: "The system did not allow the studio to use a file there.",
  },
  {
    pattern: /\bENOSPC\b|no space left on device/i,
    sentence: "The disk is full.",
  },
  {
    pattern: /\bE(?:NOTFOUND|CONNREFUSED|CONNRESET|AI_AGAIN)\b|fetch failed/i,
    sentence: "The network could not be reached.",
  },
];

function known(text: string): string | null {
  for (const { pattern, sentence } of KNOWN) {
    if (pattern.test(text)) {
      return sentence;
    }
  }
  return null;
}

function isSentence(line: string): boolean {
  return (
    line.length > 0 &&
    line.length <= LONGEST_SENTENCE &&
    SPACE.test(line) &&
    !STRUCTURED.test(line)
  );
}

export function wordFailure(
  raw: string | null | undefined,
  fallback: string
): WordedFailure {
  const text = raw?.trim() ?? "";
  if (text.length === 0) {
    return { details: null, sentence: fallback };
  }

  const [head = "", ...rest] = text.split(LINES);
  const first = head.replace(ERROR_PREFIX, "").trim();
  const mapped = known(first);
  if (mapped !== null) {
    return { details: text, sentence: mapped };
  }

  if (!isSentence(first) || NAMED_ERROR.test(head) || ENGINE.test(first)) {
    return { details: text, sentence: fallback };
  }

  const tail = rest.join("\n").trim();
  return { details: tail.length === 0 ? null : text, sentence: first };
}
