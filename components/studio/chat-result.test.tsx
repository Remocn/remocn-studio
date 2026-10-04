import { expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PreviewComposition } from "@/lib/studio/preview";
import type { PreviewMessage } from "@/preview/protocol";
import type { UserEntry } from "@/shared/ipc";
import { previewControl } from "@/test/preview-channel";
import { ChatResultLink } from "./chat-result";

const user: UserEntry = {
  assets: [],
  attachments: [],
  elements: [
    {
      column: null,
      component: "Title",
      composition: "Main",
      file: null,
      fps: 30,
      frame: 390,
      html: "",
      line: null,
      scene: null,
      stack: [],
    },
  ],
  id: "request",
  kind: "user",
  media: [],
  text: "Adjust the title",
};
const composition: PreviewComposition = {
  compositionId: "Main",
  compositions: ["Main"],
  metadata: { durationInFrames: 1800, fps: 60, height: 1080, width: 1920 },
  reason: "asked",
  source: "remocn-preview",
  total: 1,
  trouble: null,
  type: "composition",
  unmeasured: false,
};
const done = {
  entries: [
    user,
    {
      id: "answer",
      kind: "assistant" as const,
      text: "Adjusted the title animation.",
    },
  ],
  isRunning: false,
  permission: null,
  source: null,
  turnError: null,
};
function setup() {
  const open = mock();
  const { preview, surface } = previewControl({
    composition: "Main",
    pick: composition,
  });
  const view = render(
    <ChatResultLink onOpenPreview={open} preview={preview} turn={done} />
  );
  return {
    ...view,
    emit: (message: PreviewMessage) => act(() => surface.emit(message)),
    open,
    preview,
    sent: surface.sent,
  };
}
const rebuilt: PreviewMessage = { type: "rebuilt" };
it("waits for the rebuilt composition, then seeks to the selected time at the new fps", () => {
  const run = setup();
  run.emit(composition);
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
  run.emit(rebuilt);
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
  run.emit(composition);
  fireEvent.click(screen.getByRole("button", { name: "View change" }));
  expect(run.open).toHaveBeenCalledTimes(1);
  expect(run.sent).toEqual([{ frame: 780, type: "seek" }]);
});
it("hides the result during another rebuild or a composition failure", () => {
  const run = setup();
  run.emit(rebuilt);
  run.emit(composition);
  run.emit(rebuilt);
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
  run.emit({ ...composition, trouble: "Render failed" });
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
});
it("does not reuse readiness for a new request or an unfinished turn", () => {
  const run = setup();
  run.emit(rebuilt);
  run.emit(composition);
  run.rerender(
    <ChatResultLink
      onOpenPreview={run.open}
      preview={run.preview}
      turn={{ ...done, isRunning: true }}
    />
  );
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
  run.rerender(
    <ChatResultLink
      onOpenPreview={run.open}
      preview={run.preview}
      turn={{ ...done, entries: [{ ...user, id: "next" }, done.entries[1]] }}
    />
  );
  expect(screen.queryByRole("button", { name: "View change" })).toBeNull();
});
it("offers the preview without inventing a target when no element was selected", () => {
  const run = setup();
  run.rerender(
    <ChatResultLink
      onOpenPreview={run.open}
      preview={run.preview}
      turn={{ ...done, entries: [{ ...user, elements: [] }, done.entries[1]] }}
    />
  );
  run.emit(rebuilt);
  run.emit(composition);
  fireEvent.click(screen.getByRole("button", { name: "View preview" }));
  expect(run.sent).toEqual([]);
});
