import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposer } from "@/hooks/use-composer";
import type { OpenTurn } from "@/hooks/use-open-turn";
import { useQueue } from "@/hooks/use-queue";
import type { QueuedMessage } from "@/lib/studio/turns";
import type { PromptAttachment } from "@/shared/ipc";

const IMAGE: PromptAttachment = {
  mediaType: "image/png",
  name: "shot.png",
  path: "/Users/me/Desktop/shot.png",
};

function message(id: string, text: string): QueuedMessage {
  return {
    assets: [],
    attachments: [IMAGE],
    effort: "high",
    elements: [],
    id,
    media: [],
    model: "opus",
    playing: null,
    projectId: "project-1",
    text,
  };
}

function clickOn(value: string) {
  return {
    currentTarget: { value },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

function bound(queue: readonly QueuedMessage[], removeQueued = vi.fn()) {
  return renderHook(() => {
    const composer = useComposer({ onSubmit: vi.fn(), projectId: "project-1" });
    const turn = { queue, removeQueued } as unknown as OpenTurn;
    return { composer, queue: useQueue(turn, composer) };
  });
}

describe("useQueue", () => {
  it("puts a queued message back in an empty composer", () => {
    const removeQueued = vi.fn();
    const { result } = bound(
      [message("a", "[Image #1] now in red")],
      removeQueued
    );

    act(() => {
      result.current.queue.onEdit(clickOn("a"));
    });

    expect(result.current.composer.value).toBe("[Image #1] now in red");
    expect(result.current.composer.attachments.items).toEqual([IMAGE]);
    expect(removeQueued).toHaveBeenCalledWith("a");
  });

  it("leaves a draft alone rather than overwriting it", () => {
    const removeQueued = vi.fn();
    const { result } = bound([message("a", "now in red")], removeQueued);

    act(() => {
      result.current.composer.onChange({
        currentTarget: { selectionStart: 5, value: "still" },
        target: { selectionStart: 5, value: "still" },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    act(() => {
      result.current.queue.onEdit(clickOn("a"));
    });

    expect(result.current.composer.value).toBe("still");
    expect(removeQueued).not.toHaveBeenCalled();
  });

  it("drops a queued message the row asks it to drop", () => {
    const removeQueued = vi.fn();
    const { result } = bound([message("a", "now in red")], removeQueued);

    act(() => {
      result.current.queue.onRemove(clickOn("a"));
    });

    expect(removeQueued).toHaveBeenCalledWith("a");
    expect(result.current.composer.value).toBe("");
  });
});
