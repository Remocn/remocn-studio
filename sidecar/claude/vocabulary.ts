import type { ToolVerb } from "@/shared/providers";

// Claude Code's tool names translated into the neutral vocabulary the icons
// key on. A name outside the map (the Notebook pair, MCP tools) stays null and
// the webview falls back to the name, exactly as it does for rows stored
// before verbs existed.
const VERBS: ReadonlyMap<string, ToolVerb> = new Map<string, ToolVerb>([
  ["Bash", "run"],
  ["Edit", "edit"],
  ["ExitPlanMode", "plan"],
  ["Glob", "find"],
  ["Grep", "search"],
  ["MultiEdit", "edit"],
  ["Read", "read"],
  ["Task", "subagent"],
  ["TaskCreate", "task"],
  ["TaskGet", "task"],
  ["TaskList", "task"],
  ["TaskUpdate", "task"],
  ["TodoWrite", "task"],
  ["WebFetch", "web"],
  ["WebSearch", "web"],
  ["Write", "create"],
]);

export function verbOf(toolName: string): ToolVerb | null {
  return VERBS.get(toolName) ?? null;
}
