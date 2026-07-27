import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Transcript } from "@/components/studio/transcript";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { TranscriptEntry } from "@/shared/ipc";

const CWD = "/Users/me/projects/my-video";

const ANSWER = [
  "## Done",
  "",
  "- wrote the scene with `useCurrentFrame`",
  "",
  "```tsx",
  "const frame = useCurrentFrame();",
  "```",
].join("\n");

function edit(index: number): TranscriptEntry {
  return {
    id: `edit-${index}`,
    input: {
      file_path: `${CWD}/src/Scene${index}.tsx`,
      new_string: `const scene = ${index};`,
      old_string: "const scene = 0;",
    },
    kind: "activity",
    name: "Edit",
    result: "updated",
    state: "done",
  };
}

function read(
  index: number,
  state: "done" | "failed" = "done"
): TranscriptEntry {
  return {
    id: `read-${index}`,
    input: { file_path: `${CWD}/components/studio/Pane${index}.tsx` },
    kind: "activity",
    name: "Read",
    result: state === "failed" ? "File does not exist." : "…",
    state,
  };
}

function shell(id: string, command: string): TranscriptEntry {
  return {
    id,
    input: { command },
    kind: "activity",
    name: "Bash",
    result: "…",
    state: "done",
  };
}

const ENTRIES: TranscriptEntry[] = [
  {
    attachments: [],
    id: "user-0",
    kind: "user",
    text: "Build me a title card",
  },
  edit(1),
  edit(2),
  edit(3),
  {
    id: "bash-1",
    input: { command: "bun run build" },
    kind: "activity",
    name: "Bash",
    result: "compiled",
    state: "failed",
  },
  { id: "assistant-0", kind: "assistant", text: ANSWER },
];

function renderTranscript(
  entries: TranscriptEntry[],
  isRunning = false,
  isWaiting = false
) {
  return render(
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <Transcript
              cwd={CWD}
              entries={entries}
              error={null}
              isRunning={isRunning}
              isWaiting={isWaiting}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

describe("Transcript", () => {
  it("shows one line per tool call, with its own state", () => {
    renderTranscript(ENTRIES);

    expect(
      screen.getByRole("button", { name: "Edit src/Scene1.tsx" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit src/Scene2.tsx" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit src/Scene3.tsx" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Bash bun run build" })
    ).toBeVisible();
    expect(screen.getByText("compiled")).toBeVisible();
  });

  it("expands one of those lines into a readable diff", () => {
    renderTranscript(ENTRIES);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit src/Scene2.tsx" })
    );

    expect(screen.getByText("-const scene = 0;")).toBeVisible();
    expect(screen.getByText("+const scene = 2;")).toBeVisible();
  });

  it("renders the answer as markdown, not as raw text", () => {
    renderTranscript(ENTRIES);

    expect(screen.getByRole("heading", { name: "Done" })).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveTextContent("wrote the scene");
    expect(screen.queryByText("## Done")).not.toBeInTheDocument();
  });

  it("leaves inline code where the reveal animation can reach it", () => {
    const { container } = renderTranscript(ENTRIES);

    const inline = container.querySelector(".markdown-stream :not(pre) > code");
    const block = container.querySelector(".markdown-stream pre > code");

    expect(inline).toHaveTextContent("useCurrentFrame");
    expect(block).toHaveTextContent("useCurrentFrame()");
  });

  it("keeps the user's own words verbatim", () => {
    renderTranscript(ENTRIES);

    expect(screen.getByText("Build me a title card")).toBeVisible();
  });

  it("says it is thinking, in the transcript, while a turn waits", () => {
    renderTranscript(ENTRIES.slice(0, 1), true);

    expect(screen.getByText("Thinking…")).toBeVisible();
  });

  it("stops saying it once the answer is streaming", () => {
    renderTranscript(ENTRIES, true);

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });

  it("says nothing when no turn is running", () => {
    renderTranscript(ENTRIES.slice(0, 1));

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });

  it("waits on an approval rather than claiming to be thinking", () => {
    renderTranscript(ENTRIES.slice(0, 1), true, true);

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });

  it("takes one row for a run of reads, and says how many and where", () => {
    renderTranscript([read(1), read(2), read(3)]);

    expect(
      screen.getByRole("button", {
        name: "Read 3 files in components/studio",
      })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Read components/studio/Pane1.tsx" })
    ).not.toBeInTheDocument();
  });

  it("expands that run into exactly the rows it replaced", () => {
    renderTranscript([read(1), read(2), read(3)]);

    fireEvent.click(
      screen.getByRole("button", { name: "Read 3 files in components/studio" })
    );

    for (const index of [1, 2, 3]) {
      expect(
        screen.getByRole("button", {
          name: `Read components/studio/Pane${index}.tsx`,
        })
      ).toBeVisible();
    }
  });

  it("leaves a failed read on screen without anything being expanded", () => {
    renderTranscript([read(1), read(2, "failed"), read(3), read(4)]);

    expect(screen.getByText("File does not exist.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Read components/studio/Pane2.tsx" })
    ).toBeVisible();
  });

  it("shows the file being read right now while the run is still going", () => {
    renderTranscript([read(1), read(2), read(3)], true);

    expect(
      screen.getByRole("button", { name: "Read components/studio/Pane3.tsx" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Read 3 files in components/studio",
      })
    ).not.toBeInTheDocument();
  });

  it("turns that ticker into a count once the turn has settled", () => {
    renderTranscript([read(1), read(2), read(3)]);

    expect(
      screen.getByRole("button", { name: "Read 3 files in components/studio" })
    ).toBeVisible();
  });

  it("folds a wall of shell exploration into one row", () => {
    renderTranscript([
      shell("sh-1", `cd ${CWD} && find . -type d -name dist`),
      shell("sh-2", `cd ${CWD} && ls src/demos/ && echo "---"`),
      shell("sh-3", `cd ${CWD} && grep -rln TransitionProps src/`),
      shell("sh-4", `cd ${CWD} && cat src/demos/types.ts`),
    ]);

    expect(
      screen.getByRole("button", { name: "Bash 4 commands" })
    ).toBeVisible();
  });

  it("keeps the one command that changed something out of that row", () => {
    renderTranscript([
      shell("sh-1", `cd ${CWD} && ls src/demos/`),
      shell("sh-2", `cd ${CWD} && cat package.json`),
      shell("sh-3", `cd ${CWD} && bun add remotion`),
    ]);

    expect(
      screen.getByRole("button", { name: `Bash cd ${CWD} && bun add remotion` })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Bash 2 commands" })
    ).toBeVisible();
  });

  it("dims the cd into the open project instead of spending the row on it", () => {
    renderTranscript([shell("sh-1", `cd ${CWD} && bun run build`)]);

    expect(screen.getByText("bun run build")).toBeVisible();
    expect(screen.getByText(`cd ${CWD} &&`)).toBeVisible();
  });

  it("reports a turn that failed outright", () => {
    render(
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <Transcript
                cwd={CWD}
                entries={[]}
                error="the sidecar is not running"
                isRunning={false}
                isWaiting={false}
              />
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "the sidecar is not running"
    );
  });
});
