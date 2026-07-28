import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PromptParams } from "@/shared/ipc";
import { contentOf } from "@/sidecar/claude/content";

let shot = "";
let frame = "";

function params(shape: Partial<PromptParams>): PromptParams {
  return {
    attachments: [],
    effort: null,
    historyId: "history-1",
    mode: "auto",
    model: null,
    projectId: "project-1",
    prompt: "",
    sessionId: null,
    ...shape,
  };
}

function attachment() {
  return { mediaType: "image/png", name: "shot.png", path: shot } as const;
}

function second() {
  return { mediaType: "image/png", name: "frame.png", path: frame } as const;
}

const SHOT = {
  source: { data: "aGk=", media_type: "image/png", type: "base64" },
  type: "image",
};

const FRAME = {
  source: { data: "eW8=", media_type: "image/png", type: "base64" },
  type: "image",
};

describe("contentOf", () => {
  beforeAll(async () => {
    const folder = await mkdtemp(join(tmpdir(), "remocn-content-"));
    shot = join(folder, "shot.png");
    frame = join(folder, "frame.png");
    await writeFile(shot, "hi");
    await writeFile(frame, "yo");
  });

  it("sends a plain string when nothing is attached", async () => {
    expect(await contentOf(params({ prompt: "make a title card" }))).toBe(
      "make a title card"
    );
  });

  it("encodes an attachment as a base64 image block before the text", async () => {
    expect(
      await contentOf(
        params({ attachments: [attachment()], prompt: "use this frame" })
      )
    ).toEqual([
      {
        source: { data: "aGk=", media_type: "image/png", type: "base64" },
        type: "image",
      },
      { text: "use this frame", type: "text" },
    ]);
  });

  it("sends the image alone when the message has no words", async () => {
    expect(
      await contentOf(params({ attachments: [attachment()], prompt: "  " }))
    ).toEqual([
      {
        source: { data: "aGk=", media_type: "image/png", type: "base64" },
        type: "image",
      },
    ]);
  });

  it("puts each image where the message pointed at it", async () => {
    expect(
      await contentOf(
        params({
          attachments: [attachment(), second()],
          prompt: "compare [Image #1] with [Image #2], which is better?",
        })
      )
    ).toEqual([
      { text: "compare ", type: "text" },
      SHOT,
      { text: " with ", type: "text" },
      FRAME,
      { text: ", which is better?", type: "text" },
    ]);
  });

  it("sends an attachment nobody pointed at ahead of the message", async () => {
    expect(
      await contentOf(
        params({
          attachments: [attachment(), second()],
          prompt: "start from [Image #2]",
        })
      )
    ).toEqual([SHOT, { text: "start from ", type: "text" }, FRAME]);
  });

  it("sends an image once however often the message mentions it", async () => {
    expect(
      await contentOf(
        params({
          attachments: [attachment()],
          prompt: "[Image #1] is the one, use [Image #1]",
        })
      )
    ).toEqual([SHOT, { text: " is the one, use [Image #1]", type: "text" }]);
  });

  it("leaves a reference past the last attachment as words", async () => {
    expect(
      await contentOf(
        params({ attachments: [attachment()], prompt: "use [Image #7]" })
      )
    ).toEqual([SHOT, { text: "use [Image #7]", type: "text" }]);
  });

  it("drops the empty text a reference at the edge leaves behind", async () => {
    expect(
      await contentOf(
        params({
          attachments: [attachment(), second()],
          prompt: "[Image #1] [Image #2]",
        })
      )
    ).toEqual([SHOT, FRAME]);
  });
});
