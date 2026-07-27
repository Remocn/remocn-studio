const SEGMENTS = /&&|\|\||[;|]/;
const WRITES = /[>`]|\$\(/;
const WORDS = /\s+/;
const CD_PREFIX = /^cd\s+("[^"]*"|'[^']*'|\S+)\s*&&\s*/;

const FIND_ACTIONS = new Set([
  "-delete",
  "-exec",
  "-execdir",
  "-fls",
  "-fprint",
  "-fprint0",
  "-fprintf",
  "-ok",
  "-okdir",
]);

const GIT_READS = new Set([
  "blame",
  "branch",
  "diff",
  "log",
  "ls-files",
  "remote",
  "show",
  "status",
]);

const CURL_WRITES = /^(-[a-zA-Z]*[oO]|--output|--remote-name|--create-dirs)/;

type Reads = (args: readonly string[]) => boolean;

const anything: Reads = () => true;

const READ_ONLY: ReadonlyMap<string, Reads> = new Map<string, Reads>([
  ["cat", anything],
  ["cd", anything],
  ["curl", (args) => !args.some((arg) => CURL_WRITES.test(arg))],
  ["du", anything],
  ["echo", anything],
  ["file", anything],
  ["find", (args) => !args.some((arg) => FIND_ACTIONS.has(arg))],
  ["git", (args) => GIT_READS.has(args[0] ?? "")],
  ["grep", anything],
  ["head", anything],
  ["ls", anything],
  ["pwd", anything],
  ["rg", anything],
  ["stat", anything],
  ["tail", anything],
  ["tree", anything],
  ["wc", anything],
  ["which", anything],
]);

export function isQuietCommand(command: string): boolean {
  if (command.trim() === "" || WRITES.test(command)) {
    return false;
  }

  return command.split(SEGMENTS).every(isQuietSegment);
}

export function commandLead(command: string, cwd: string | null): string {
  if (cwd === null) {
    return "";
  }

  const found = CD_PREFIX.exec(command);
  if (found === null) {
    return "";
  }

  return folder(unquote(found[1])) === folder(cwd) ? found[0] : "";
}

function isQuietSegment(segment: string): boolean {
  const words = segment.trim().split(WORDS).filter(Boolean);
  const [head, ...args] = words;

  if (head === undefined) {
    return false;
  }
  if (head === "done" || head === "for") {
    return true;
  }
  if (head === "do") {
    return isQuietSegment(args.join(" "));
  }

  const reads = READ_ONLY.get(head);
  return reads === undefined ? false : reads(args);
}

function unquote(word: string): string {
  const quoted =
    (word.startsWith('"') && word.endsWith('"')) ||
    (word.startsWith("'") && word.endsWith("'"));

  return quoted ? word.slice(1, -1) : word;
}

function folder(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
