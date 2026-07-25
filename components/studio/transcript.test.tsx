import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Transcript } from "@/components/studio/transcript";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { TurnEntry } from "@/hooks/use-claude-turn";

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

function edit(index: number): TurnEntry {
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

const ENTRIES: TurnEntry[] = [
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

function renderTranscript(entries: TurnEntry[]) {
  return render(
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <Transcript
              cwd={CWD}
              entries={entries}
              error={null}
              isRunning={false}
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
