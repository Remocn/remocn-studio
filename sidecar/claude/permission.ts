import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { Effect } from "effect";
import type { PermissionReason } from "@/shared/ipc";

export type PermissionVerdict =
  | { readonly kind: "allow" }
  | {
      readonly kind: "ask";
      readonly reason: PermissionReason;
      readonly signature: string;
    };

const PATH_FIELDS: Record<string, readonly string[]> = {
  Edit: ["file_path"],
  Glob: ["path"],
  Grep: ["path"],
  MultiEdit: ["file_path"],
  NotebookEdit: ["notebook_path"],
  NotebookRead: ["notebook_path"],
  Read: ["file_path"],
  Write: ["file_path"],
};

const FREE_TOOLS = new Set([
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskUpdate",
  "TodoWrite",
]);

export const EXIT_PLAN_TOOL = "ExitPlanMode";

const ALLOW: PermissionVerdict = { kind: "allow" };

const STUDIO_TOOL_PREFIXES = [
  "mcp__remocn-pipeline__",
  "mcp__remocn-library__",
];

export function review(
  cwd: string,
  toolName: string,
  input: Record<string, unknown>
): Effect.Effect<PermissionVerdict> {
  if (toolName === EXIT_PLAN_TOOL) {
    return Effect.succeed(ask("plan", toolName, text(input, "plan") ?? ""));
  }

  if (toolName === "Bash") {
    return Effect.succeed(ask("bash", toolName, text(input, "command") ?? ""));
  }

  if (
    FREE_TOOLS.has(toolName) ||
    STUDIO_TOOL_PREFIXES.some((prefix) => toolName.startsWith(prefix))
  ) {
    return Effect.succeed(ALLOW);
  }

  const fields = PATH_FIELDS[toolName];
  if (fields === undefined) {
    return Effect.succeed(ask("tool", toolName, ""));
  }

  const targets = fields.flatMap((field) => text(input, field) ?? []);

  return Effect.promise(() => escapee(cwd, targets)).pipe(
    Effect.map((escaped) =>
      escaped === null ? ALLOW : ask("outside", toolName, escaped)
    )
  );
}

export function signatureOf(toolName: string, detail: string): string {
  return JSON.stringify([toolName, detail]);
}

function ask(
  reason: PermissionReason,
  toolName: string,
  detail: string
): PermissionVerdict {
  return { kind: "ask", reason, signature: signatureOf(toolName, detail) };
}

async function escapee(
  cwd: string,
  targets: readonly string[]
): Promise<string | null> {
  if (targets.length === 0) {
    return null;
  }

  const [root, ...resolved] = await Promise.all([
    real(resolve(cwd)),
    ...targets.map((target) =>
      real(isAbsolute(target) ? target : resolve(cwd, target))
    ),
  ]);

  return resolved.find((target) => !inside(root, target)) ?? null;
}

async function real(target: string): Promise<string> {
  try {
    return await realpath(target);
  } catch {
    const parent = dirname(target);
    if (parent === target) {
      return target;
    }
    return join(await real(parent), basename(target));
  }
}

function inside(root: string, target: string): boolean {
  return (
    target === root ||
    target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
  );
}

function text(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
