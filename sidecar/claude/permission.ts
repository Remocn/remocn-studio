import { Effect } from "effect";
import type { PermissionReason } from "@/shared/ipc";
import { shippedBundleDir } from "../agent/knowledge";
import { type PermissionVerdict, signatureOf } from "../agent/verdict";
import { escapee } from "../contained";
import { isOutwardTool, TOOL_SERVERS } from "../tools/specs";

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

const READING_TOOLS = new Set(["Glob", "Grep", "NotebookRead", "Read"]);

// The agent's own bookkeeping, and the two tools that only read instructions:
// loading a skill, and looking up a deferred tool's definition. Whatever a
// skill then asks to run or read is judged on its own call.
const FREE_TOOLS = new Set([
  "Skill",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskUpdate",
  "TodoWrite",
  "ToolSearch",
]);

export const EXIT_PLAN_TOOL = "ExitPlanMode";

const ALLOW: PermissionVerdict = { kind: "allow" };

const STUDIO_TOOL_PREFIXES = TOOL_SERVERS.map((server) => `mcp__${server}__`);

export function review(
  cwd: string,
  toolName: string,
  input: Record<string, unknown>,
  outward: (tool: string) => boolean = isOutwardTool
): Effect.Effect<PermissionVerdict> {
  if (toolName === EXIT_PLAN_TOOL) {
    return Effect.succeed(ask("plan", toolName, text(input, "plan") ?? ""));
  }

  if (toolName === "Bash") {
    return Effect.succeed(ask("bash", toolName, text(input, "command") ?? ""));
  }

  const studio = STUDIO_TOOL_PREFIXES.find((prefix) =>
    toolName.startsWith(prefix)
  );

  if (studio !== undefined && outward(toolName.slice(studio.length))) {
    return Effect.succeed(
      ask("outward", toolName, text(input, "summary") ?? "")
    );
  }

  if (FREE_TOOLS.has(toolName) || studio !== undefined) {
    return Effect.succeed(ALLOW);
  }

  const fields = PATH_FIELDS[toolName];
  if (fields === undefined) {
    return Effect.succeed(ask("tool", toolName, ""));
  }

  const targets = fields.flatMap((field) => text(input, field) ?? []);

  return Effect.promise(() =>
    escapee(cwd, readRootsFor(toolName), targets)
  ).pipe(
    Effect.map((escaped) =>
      escaped === null ? ALLOW : ask("outside", toolName, escaped)
    )
  );
}

function ask(
  reason: PermissionReason,
  toolName: string,
  detail: string
): PermissionVerdict {
  return { kind: "ask", reason, signature: signatureOf(toolName, detail) };
}

function readRootsFor(toolName: string): readonly string[] {
  const dir = shippedBundleDir();
  return READING_TOOLS.has(toolName) && dir !== null ? [dir] : [];
}

function text(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
