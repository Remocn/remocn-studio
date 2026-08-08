import { commandLead } from "./commands";
import { type DiffLine, diffLines } from "./diff";

export interface ToolCall {
  input: unknown;
  name: string;
  result: string | null;
}

export type ToolDetail =
  | { command: string; kind: "command"; output: string }
  | { kind: "diff"; lines: DiffLine[] }
  | { kind: "text"; text: string };

export interface ToolTarget {
  kind: "path" | "text";
  lead: string;
  name: string;
}

const TARGET_KEYS = [
  "file_path",
  "notebook_path",
  "command",
  "pattern",
  "url",
  "path",
  "subject",
  "description",
];

const PATH_KEYS = new Set(["file_path", "notebook_path", "path"]);

const SEPARATOR = "/";

const FAILURE_LINES = 3;

export function toolTargetParts(
  input: unknown,
  cwd: string | null
): ToolTarget | null {
  const record = fields(input);

  for (const key of TARGET_KEYS) {
    const value = string(record, key);
    if (value !== null) {
      return splitTarget(key, value, cwd);
    }
  }

  return null;
}

export function toolTarget(input: unknown, cwd: string | null): string | null {
  const target = toolTargetParts(input, cwd);
  return target === null ? null : targetText(target);
}

export function targetText(target: ToolTarget): string {
  return `${target.lead}${target.name}`;
}

export function toolDetail(call: ToolCall): ToolDetail | null {
  const record = fields(call.input);

  if (call.name === "Write") {
    const content = string(record, "content");
    return content === null
      ? textOf(call.result)
      : { kind: "diff", lines: diffLines("", content) };
  }

  if (call.name === "Edit") {
    const before = string(record, "old_string");
    const after = string(record, "new_string");
    return before === null && after === null
      ? textOf(call.result)
      : { kind: "diff", lines: diffLines(before ?? "", after ?? "") };
  }

  if (call.name === "Bash") {
    const command = string(record, "command");
    return command === null
      ? textOf(call.result)
      : { command, kind: "command", output: call.result ?? "" };
  }

  return textOf(call.result);
}

export function toolFailure(result: string | null): string | null {
  const text = result?.trim() ?? "";
  if (text.length === 0) {
    return null;
  }

  const lines = text.split("\n");
  const head = lines.slice(0, FAILURE_LINES).join("\n");
  return lines.length > FAILURE_LINES ? `${head}…` : head;
}

export function relativeTo(path: string, cwd: string | null): string {
  if (cwd === null) {
    return path;
  }

  const base = cwd.endsWith("/") ? cwd : `${cwd}/`;
  return path.startsWith(base) ? path.slice(base.length) : path;
}

function splitTarget(
  key: string,
  value: string,
  cwd: string | null
): ToolTarget {
  if (PATH_KEYS.has(key)) {
    return splitPath(relativeTo(value, cwd));
  }

  const lead = key === "command" ? commandLead(value) : "";
  return { kind: "text", lead, name: value.slice(lead.length) };
}

function splitPath(path: string): ToolTarget {
  const tail = path.endsWith(SEPARATOR) ? path.length - 1 : path.length;
  const cut = path.lastIndexOf(SEPARATOR, tail - 1);

  return {
    kind: "path",
    lead: cut === -1 ? "" : path.slice(0, cut + 1),
    name: path.slice(cut + 1),
  };
}

function textOf(result: string | null): ToolDetail | null {
  const text = result?.trim() ?? "";
  return text.length === 0 ? null : { kind: "text", text };
}

function fields(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

function string(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
