import { describe, expect, it } from "vitest";
import type { PromptParams } from "@/shared/ipc";
import { inputOf } from "./content";

function params(shape: Partial<PromptParams>): PromptParams {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId: "history-1",
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId: "project-1",
    prompt: "",
    provider: "codex",
    sessionId: null,
    ...shape,
  };
}

const SHOT = {
  mediaType: "image/png" as const,
  name: "shot.png",
  path: "/pasted/shot.png",
};

describe("inputOf", () => {
  it("stays a plain string when there is nothing to splice", () => {
    expect(inputOf(params({ prompt: "make a title card" }))).toBe(
      "make a title card"
    );
  });

  it("splices a referenced image in place, as a path and not as bytes", () => {
    expect(
      inputOf(
        params({
          attachments: [SHOT],
          prompt: "Make it look like [Image #1] but darker",
        })
      )
    ).toEqual([
      { text: "Make it look like ", type: "text" },
      { path: "/pasted/shot.png", type: "local_image" },
      { text: " but darker", type: "text" },
    ]);
  });

  it("puts an unreferenced image first, ahead of the words", () => {
    expect(
      inputOf(params({ attachments: [SHOT], prompt: "make this" }))
    ).toEqual([
      { path: "/pasted/shot.png", type: "local_image" },
      { text: "make this", type: "text" },
    ]);
  });

  it("appends the briefs after the message", () => {
    expect(
      inputOf(params({ prompt: "use the intro clip" }), "The assets: intro.mp4")
    ).toEqual([
      { text: "use the intro clip", type: "text" },
      { text: "The assets: intro.mp4", type: "text" },
    ]);
  });
});
