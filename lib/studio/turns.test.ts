import { describe, expect, it } from "vitest";
import {
  dropQueued,
  enqueue,
  IDLE_TURN,
  nextQueued,
  type QueuedMessage,
  queuedCounts,
  queuedLabel,
  type TurnState,
} from "@/lib/studio/turns";
import type { PromptAttachment, PromptElement } from "@/shared/ipc";

const IMAGE: PromptAttachment = {
  mediaType: "image/png",
  name: "shot.png",
  path: "/Users/me/Desktop/shot.png",
};

const ELEMENT: PromptElement = {
  column: 7,
  component: "TitleCard",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/TitleCard.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

function message(id: string, text = "now in red"): QueuedMessage {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    id,
    media: [],
    model: null,
    playing: null,
    projectId: "project-1",
    text,
  };
}

function waiting(turn: TurnState): TurnState {
  return {
    ...turn,
    permissions: [
      {
        askedAt: 0,
        id: "ask-1",
        input: {},
        name: "Bash",
        reason: "outside",
      },
    ],
  };
}

describe("the message queue", () => {
  it("keeps queued messages in the order they were written", () => {
    const turn = enqueue(enqueue(IDLE_TURN, message("a")), message("b"));

    expect(turn.queue.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("drops the message it is asked for and leaves the rest alone", () => {
    const turn = enqueue(enqueue(IDLE_TURN, message("a")), message("b"));

    expect(dropQueued(turn, "a").queue.map((item) => item.id)).toEqual(["b"]);
  });

  it("returns the same turn when nothing matched", () => {
    const turn = enqueue(IDLE_TURN, message("a"));

    expect(dropQueued(turn, "gone")).toBe(turn);
  });

  it("hands out the head of the queue when the turn settled cleanly", () => {
    const turn = enqueue(enqueue(IDLE_TURN, message("a")), message("b"));

    expect(nextQueued(turn, false)?.id).toBe("a");
  });

  it("hands out nothing when the turn failed", () => {
    const turn = enqueue(IDLE_TURN, message("a"));

    expect(nextQueued(turn, true)).toBeNull();
  });

  it("hands out nothing while a permission is unanswered", () => {
    const turn = waiting(enqueue(IDLE_TURN, message("a")));

    expect(nextQueued(turn, false)).toBeNull();
  });

  it("hands out nothing when there is nothing queued", () => {
    expect(nextQueued(IDLE_TURN, false)).toBeNull();
  });

  it("reads a queued message by its own text", () => {
    expect(queuedLabel(message("a", "  now in red  "))).toBe("now in red");
  });

  it("says what a wordless message carries instead of showing nothing", () => {
    const carried = { ...message("a", ""), attachments: [IMAGE] };

    expect(queuedLabel(carried)).toBe("1 attachment");
    expect(queuedLabel({ ...carried, elements: [ELEMENT] })).toBe(
      "2 attachments"
    );
  });

  it("counts a queued message's references on their own ladders", () => {
    const carried = {
      ...message("a"),
      attachments: [IMAGE],
      elements: [ELEMENT],
    };

    expect(queuedCounts(carried)).toEqual({ asset: 0, element: 1, image: 1 });
  });
});
