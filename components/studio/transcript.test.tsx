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
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const STARTED = NOW - 12_000;
const TIMER = /^\d+[dhms]( \d+[hms])?$/;
const BACKEND = /Backend/;
const FRONTEND = /Frontend/;

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
    verb: null,
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
    verb: null,
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
    verb: null,
  };
}

const ENTRIES: TranscriptEntry[] = [
  {
    assets: [],
    attachments: [],
    elements: [],
    id: "user-0",
    kind: "user",
    media: [],
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
    verb: null,
  },
  { id: "assistant-0", kind: "assistant", text: ANSWER },
];

function renderTranscript(
  entries: TranscriptEntry[],
  isRunning = false,
  isWaiting = false,
  startedAt: number | null = STARTED
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
              now={NOW}
              startedAt={startedAt}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

describe("Transcript", () => {
  it("spends one row on a run of calls, and shows the last of them", () => {
    renderTranscript(ENTRIES);

    expect(
      screen.getByRole("button", { name: "Edit src/Scene3.tsx, 2 more" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Edit src/Scene1.tsx" })
    ).not.toBeInTheDocument();
  });

  it("keeps the call that failed out of that row, error and all", () => {
    renderTranscript(ENTRIES);

    expect(
      screen.getByRole("button", { name: "Bash bun run build" })
    ).toBeVisible();
    expect(screen.getByText("compiled")).toBeVisible();
  });

  it("expands one of those lines into a readable diff", () => {
    renderTranscript(ENTRIES);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit src/Scene3.tsx, 2 more" })
    );
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

  it("says how long the turn has been running, beside it", () => {
    renderTranscript(ENTRIES.slice(0, 1), true);

    expect(screen.getByText("12s")).toBeVisible();
  });

  it("counts the whole turn, not the last thing it did", () => {
    renderTranscript(ENTRIES.slice(0, 1), true, false, NOW - 125_000);

    expect(screen.getByText("2m 5s")).toBeVisible();
  });

  it("stops saying it once the answer is streaming", () => {
    renderTranscript(ENTRIES, true);

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument();
  });

  it("says nothing when no turn is running", () => {
    renderTranscript(ENTRIES.slice(0, 1));

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument();
  });

  it("waits on an approval rather than claiming to be thinking", () => {
    renderTranscript(ENTRIES.slice(0, 1), true, true);

    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument();
  });

  it("says only that it is thinking when the turn has no start", () => {
    renderTranscript(ENTRIES.slice(0, 1), true, false, null);

    expect(screen.getByText("Thinking…")).toBeVisible();
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument();
  });

  it("takes one row for a run of reads, and says how many and where", () => {
    renderTranscript([read(1), read(2), read(3)]);

    expect(
      screen.getByRole("button", {
        name: "Read components/studio/Pane3.tsx, 2 more",
      })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Read components/studio/Pane1.tsx" })
    ).not.toBeInTheDocument();
  });

  it("expands that run into exactly the rows it replaced", () => {
    renderTranscript([read(1), read(2), read(3)]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Read components/studio/Pane3.tsx, 2 more",
      })
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

  it("folds a wall of shell calls into the last of them", () => {
    renderTranscript([
      shell("sh-1", `cd ${CWD} && find . -type d -name dist`),
      shell("sh-2", `cd ${CWD} && ls src/demos/ && echo "---"`),
      shell("sh-3", `cd ${CWD} && bun add remotion`),
      shell("sh-4", `cd ${CWD} && cat src/demos/types.ts`),
    ]);

    expect(
      screen.getByRole("button", {
        name: `Bash cd ${CWD} && cat src/demos/types.ts, 3 more`,
      })
    ).toBeVisible();
  });

  it("dims the cd instead of spending the row on it", () => {
    renderTranscript([shell("sh-1", `cd ${CWD} && bun run build`)]);

    expect(screen.getByText("bun run build")).toBeVisible();
    expect(screen.getByText(`cd ${CWD} &&`)).toBeVisible();
  });

  it("dims it even when the agent works above the folder that was opened", () => {
    render(
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <Transcript
                cwd={`${CWD}/src/demos/one`}
                entries={[shell("sh-1", `cd ${CWD} && bun run build`)]}
                error={null}
                isRunning={false}
                isWaiting={false}
                now={NOW}
                startedAt={null}
              />
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    );

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
                now={NOW}
                startedAt={null}
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
  it("shows the plan as one checklist of subjects, with states and detail", () => {
    renderTranscript([
      {
        id: "c1",
        input: {
          activeForm: "Building the backend",
          description: "Create promotions table migration",
          subject: "Backend",
        },
        kind: "activity",
        name: "TaskCreate",
        result: "Task #1 created successfully: Backend",
        state: "done",
        verb: null,
      },
      {
        id: "c2",
        input: { description: "Wire the scene", subject: "Frontend" },
        kind: "activity",
        name: "TaskCreate",
        result: "Task #2 created successfully: Frontend",
        state: "done",
        verb: null,
      },
      {
        id: "u1",
        input: { status: "in_progress", taskId: "1" },
        kind: "activity",
        name: "TaskUpdate",
        result: "Updated task #1 status",
        state: "done",
        verb: null,
      },
    ]);

    expect(screen.queryByText("TaskCreate")).not.toBeInTheDocument();
    expect(screen.queryByText("TaskUpdate")).not.toBeInTheDocument();

    const backend = screen.getByRole("button", { name: BACKEND });
    expect(backend).toBeVisible();
    expect(screen.getByRole("button", { name: FRONTEND })).toBeVisible();
    expect(screen.getByLabelText("In progress")).toBeVisible();
    expect(screen.getAllByLabelText("Pending")).toHaveLength(1);

    fireEvent.click(backend);

    expect(screen.getByText("Create promotions table migration")).toBeVisible();
  });

  it("says which task is running instead of Thinking", () => {
    renderTranscript(
      [
        {
          id: "c1",
          input: { activeForm: "Building the backend", subject: "Backend" },
          kind: "activity",
          name: "TaskCreate",
          result: "Task #1 created successfully: Backend",
          state: "done",
          verb: null,
        },
        {
          id: "u1",
          input: { status: "in_progress", taskId: "1" },
          kind: "activity",
          name: "TaskUpdate",
          result: "Updated task #1 status",
          state: "done",
          verb: null,
        },
      ],
      true
    );

    expect(screen.getByText("Building the backend")).toBeVisible();
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });
});
