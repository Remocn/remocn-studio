import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityIcon } from "@/components/studio/activity-icon";
import type { ActivityState } from "@/shared/ipc";
import type { ToolVerb } from "@/shared/providers";
import { verbOf } from "@/sidecar/claude/vocabulary";

const CLAUDE_TOOLS = [
  "Bash",
  "Edit",
  "ExitPlanMode",
  "Glob",
  "Grep",
  "MultiEdit",
  "NotebookEdit",
  "NotebookRead",
  "Read",
  "Task",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskUpdate",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Write",
];

function iconOf(name: string, state: ActivityState = "done"): Element | null {
  const { container } = render(
    <ActivityIcon name={name} state={state} verb={null} />
  );
  return container.querySelector("svg");
}

function iconOfVerb(verb: ToolVerb, name = "SomeProviderTool"): Element | null {
  const { container } = render(
    <ActivityIcon name={name} state="done" verb={verb} />
  );
  return container.querySelector("svg");
}

describe("ActivityIcon", () => {
  it("gives each kind of work a silhouette of its own", () => {
    expect(iconOf("Bash")).toHaveClass("lucide-terminal");
    expect(iconOf("Read")).toHaveClass("lucide-eye");
    expect(iconOf("Write")).toHaveClass("lucide-file-plus");
    expect(iconOf("Edit")).toHaveClass("lucide-pencil");
    expect(iconOf("Grep")).toHaveClass("lucide-search");
    expect(iconOf("Task")).toHaveClass("lucide-bot");
  });

  it("draws the same silhouette through the verb as the name map does", () => {
    for (const name of CLAUDE_TOOLS) {
      const verb = verbOf(name);
      if (verb !== null) {
        expect(iconOfVerb(verb)?.getAttribute("class"), name).toBe(
          iconOf(name)?.getAttribute("class")
        );
      }
    }
  });

  it("keys on the adapter's verb first, whatever the tool is called", () => {
    expect(iconOfVerb("run")).toHaveClass("lucide-terminal");
    expect(iconOfVerb("edit")).toHaveClass("lucide-pencil");
    expect(iconOfVerb("create")).toHaveClass("lucide-file-plus");
    expect(iconOfVerb("plan")).toHaveClass("lucide-clipboard-check");
    expect(iconOfVerb("subagent")).toHaveClass("lucide-bot");
  });

  it("reads the name when there is no verb, so stored rows keep their icons", () => {
    expect(iconOf("NotebookEdit")).toHaveClass("lucide-notebook-pen");
  });

  it("falls back to a tool rather than to nothing", () => {
    expect(iconOf("SomeNewTool")).toHaveClass("lucide-wrench");
  });

  it("is not fooled by a name off Object's prototype", () => {
    expect(iconOf("constructor")).toHaveClass("lucide-wrench");
  });

  it("keeps state in the colour, so running and failed stay findable", () => {
    expect(iconOf("Read", "done")).toHaveClass("text-muted-foreground");
    expect(iconOf("Read", "failed")).toHaveClass("text-destructive");
    expect(iconOf("Read", "running")).toHaveClass("animate-pulse");
  });

  it("stays out of the accessible name, which the button already carries", () => {
    expect(iconOf("Bash")).toHaveAttribute("aria-hidden", "true");
  });
});
