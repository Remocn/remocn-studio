import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityIcon } from "@/components/studio/activity-icon";
import type { ActivityState } from "@/shared/ipc";

function iconOf(name: string, state: ActivityState = "done"): Element | null {
  const { container } = render(<ActivityIcon name={name} state={state} />);
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
