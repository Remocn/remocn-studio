import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";
import {
  BotIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FilePlusIcon,
  type Icon,
  NotebookPenIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "@/components/icons";
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

function silhouette(icon: Element | null): string | undefined {
  return icon?.innerHTML;
}

function expectedSilhouette(IconComponent: Icon): string | undefined {
  return render(<IconComponent />).container.querySelector("svg")?.innerHTML;
}

describe("ActivityIcon", () => {
  it("gives each kind of work a silhouette of its own", () => {
    expect(silhouette(iconOf("Bash"))).toBe(expectedSilhouette(TerminalIcon));
    expect(silhouette(iconOf("Read"))).toBe(expectedSilhouette(EyeIcon));
    expect(silhouette(iconOf("Write"))).toBe(expectedSilhouette(FilePlusIcon));
    expect(silhouette(iconOf("Edit"))).toBe(expectedSilhouette(PencilIcon));
    expect(silhouette(iconOf("Grep"))).toBe(expectedSilhouette(SearchIcon));
    expect(silhouette(iconOf("Task"))).toBe(expectedSilhouette(BotIcon));
  });

  it("draws the same silhouette through the verb as the name map does", () => {
    for (const name of CLAUDE_TOOLS) {
      const verb = verbOf(name);
      if (verb !== null) {
        expect(silhouette(iconOfVerb(verb)), name).toBe(
          silhouette(iconOf(name))
        );
      }
    }
  });

  it("keys on the adapter's verb first, whatever the tool is called", () => {
    expect(silhouette(iconOfVerb("run"))).toBe(
      expectedSilhouette(TerminalIcon)
    );
    expect(silhouette(iconOfVerb("edit"))).toBe(expectedSilhouette(PencilIcon));
    expect(silhouette(iconOfVerb("create"))).toBe(
      expectedSilhouette(FilePlusIcon)
    );
    expect(silhouette(iconOfVerb("plan"))).toBe(
      expectedSilhouette(ClipboardCheckIcon)
    );
    expect(silhouette(iconOfVerb("subagent"))).toBe(
      expectedSilhouette(BotIcon)
    );
  });

  it("reads the name when there is no verb, so stored rows keep their icons", () => {
    expect(silhouette(iconOf("NotebookEdit"))).toBe(
      expectedSilhouette(NotebookPenIcon)
    );
  });

  it("falls back to a tool rather than to nothing", () => {
    expect(silhouette(iconOf("SomeNewTool"))).toBe(
      expectedSilhouette(WrenchIcon)
    );
  });

  it("is not fooled by a name off Object's prototype", () => {
    expect(silhouette(iconOf("constructor"))).toBe(
      expectedSilhouette(WrenchIcon)
    );
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
