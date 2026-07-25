import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityLine } from "@/components/studio/activity-line";
import type { ActivityEntry } from "@/shared/ipc";

const CWD = "/Users/me/projects/my-video";
const MORE_LINES = /Show \d+ more/;

function entry(shape: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: "t1",
    input: {},
    kind: "activity",
    name: "Read",
    result: null,
    state: "done",
    ...shape,
  };
}

function lines(count: number): string {
  return Array.from({ length: count }, (_, i) => `line ${i}`).join("\n");
}

function detailOf(container: HTMLElement): string {
  return (
    container.querySelector("[data-slot=activity-detail]")?.textContent ?? ""
  );
}

describe("ActivityLine", () => {
  it("names the tool and its target relative to the open folder", () => {
    render(
      <ActivityLine
        cwd={CWD}
        entry={entry({ input: { file_path: `${CWD}/src/Scene.tsx` } })}
      />
    );

    expect(screen.getByText("Read")).toBeVisible();
    expect(screen.getByText("src/Scene.tsx")).toBeVisible();
  });

  it("expands an edit into a diff", () => {
    render(
      <ActivityLine
        cwd={CWD}
        entry={entry({
          input: {
            file_path: `${CWD}/src/Scene.tsx`,
            new_string: "const b = 2;",
            old_string: "const a = 1;",
          },
          name: "Edit",
          result: "updated",
        })}
      />
    );

    expect(screen.queryByText("+const b = 2;")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit src/Scene.tsx" }));

    expect(screen.getByText("-const a = 1;")).toBeVisible();
    expect(screen.getByText("+const b = 2;")).toBeVisible();
  });

  it("expands a command next to its output", () => {
    const { container } = render(
      <ActivityLine
        cwd={CWD}
        entry={entry({
          input: { command: "bun run build" },
          name: "Bash",
          result: "compiled",
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Bash bun run build" }));

    expect(detailOf(container)).toContain("$bun run build");
    expect(detailOf(container)).toContain("compiled");
  });

  it("shows the error of a failed call without expanding it", () => {
    render(
      <ActivityLine
        cwd={CWD}
        entry={entry({
          input: { file_path: "/nope.tsx" },
          result: "File does not exist.",
          state: "failed",
        })}
      />
    );

    expect(screen.getByText("File does not exist.")).toBeVisible();
  });

  it("cannot be expanded while the tool is still running", () => {
    render(
      <ActivityLine
        cwd={CWD}
        entry={entry({ result: null, state: "running" })}
      />
    );

    expect(screen.getByRole("button", { name: "Read" })).toBeDisabled();
  });

  it("truncates a long output and expands it on demand", () => {
    const { container } = render(
      <ActivityLine cwd={CWD} entry={entry({ result: lines(200) })} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Read" }));

    expect(detailOf(container)).toContain("line 59");
    expect(detailOf(container)).not.toContain("line 60");

    fireEvent.click(
      screen.getByRole("button", { name: "Show 140 more lines" })
    );

    expect(detailOf(container)).toContain("line 199");
    expect(
      screen.queryByRole("button", { name: MORE_LINES })
    ).not.toBeInTheDocument();
  });
});
