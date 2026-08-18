import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PromptElement, PromptParams } from "@/shared/ipc";
import { contentOf } from "@/sidecar/claude/content";

let shot = "";
let frame = "";

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
    provider: "claude",
    sessionId: null,
    ...shape,
  };
}

function element(shape: Partial<PromptElement> = {}): PromptElement {
  return {
    column: 7,
    component: "TitleCard",
    composition: "Main",
    file: "/Users/me/video/src/TitleCard.tsx",
    fps: 30,
    frame: 42,
    html: "<h1>Hello</h1>",
    line: 12,
    scene: { durationInFrames: 90, frame: 12, from: 30, name: "Opening" },
    stack: ["Opening (/Users/me/video/src/Opening.tsx:8:5)"],
    ...shape,
  };
}

function trailer(content: Awaited<ReturnType<typeof contentOf>>): string {
  if (typeof content === "string") {
    return "";
  }
  const last = content.at(-1);
  return last?.type === "text" ? last.text : "";
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

describe("contentOf with elements", () => {
  it("keeps the token in the sentence and appends the block after it", async () => {
    const content = await contentOf(
      params({ elements: [element()], prompt: "make [Element #1] bigger" })
    );

    expect(Array.isArray(content) && content[0]).toEqual({
      text: "make [Element #1] bigger",
      type: "text",
    });
    expect(trailer(content)).toContain("[Element #1]");
  });

  it("says where the element came from", async () => {
    const content = await contentOf(
      params({ elements: [element()], prompt: "make [Element #1] bigger" })
    );

    expect(trailer(content)).toContain(
      "file: /Users/me/video/src/TitleCard.tsx:12:7"
    );
    expect(trailer(content)).toContain("component: TitleCard");
  });

  it("gives the frame in the composition and inside the scene", async () => {
    const content = await contentOf(
      params({ elements: [element()], prompt: "later [Element #1]" })
    );

    expect(trailer(content)).toContain("composition: Main, frame 42");
    expect(trailer(content)).toContain(
      "scene: Opening, from frame 30 for 90 frames, at frame 12 within it"
    );
  });

  it("keeps the component stack, so the scene is told from its wrapper", async () => {
    const content = await contentOf(
      params({ elements: [element()], prompt: "[Element #1]" })
    );

    expect(trailer(content)).toContain(
      "rendered through: Opening (/Users/me/video/src/Opening.tsx:8:5)"
    );
  });

  it("says so plainly when the source could not be resolved", async () => {
    const content = await contentOf(
      params({
        elements: [
          element({ column: null, component: null, file: null, line: null }),
        ],
        prompt: "[Element #1]",
      })
    );

    expect(trailer(content)).toContain("file: unresolved");
    expect(trailer(content)).toContain("component: unknown");
  });

  it("numbers the blocks to match the tokens in the message", async () => {
    const content = await contentOf(
      params({
        elements: [element(), element({ component: "Chip" })],
        prompt: "move [Element #2] under [Element #1]",
      })
    );

    const text = trailer(content);
    expect(text.indexOf("[Element #1]")).toBeLessThan(
      text.indexOf("[Element #2]")
    );
    expect(text).toContain("component: Chip");
  });

  it("gives two selections of the same element a block each", async () => {
    const content = await contentOf(
      params({
        elements: [element(), element()],
        prompt: "[Element #1] and [Element #2]",
      })
    );

    expect(trailer(content).match(/component: TitleCard/g)).toHaveLength(2);
  });

  it("truncates markup that would swamp the message", async () => {
    const content = await contentOf(
      params({
        elements: [element({ html: `<p>${"x".repeat(4000)}</p>` })],
        prompt: "[Element #1]",
      })
    );

    expect(trailer(content).length).toBeLessThan(2600);
    expect(trailer(content)).toContain("…");
  });

  it("carries the selection when the message is only a token", async () => {
    const content = await contentOf(
      params({ elements: [element()], prompt: "[Element #1]" })
    );

    expect(Array.isArray(content) && content.length).toBe(2);
  });

  it("puts the blocks after the images, not among them", async () => {
    const content = await contentOf(
      params({
        attachments: [attachment()],
        elements: [element()],
        prompt: "like [Image #1], make [Element #1] bigger",
      })
    );

    expect(content).toEqual([
      { text: "like ", type: "text" },
      SHOT,
      { text: ", make [Element #1] bigger", type: "text" },
      { text: expect.stringContaining("[Element #1]"), type: "text" },
    ]);
  });

  it("leaves a message with no selections byte for byte what it was", async () => {
    expect(await contentOf(params({ prompt: "make a title card" }))).toBe(
      "make a title card"
    );
  });

  it("appends the asset block the sidecar wrote after copying them", async () => {
    const content = await contentOf(
      params({
        assets: [
          {
            name: "Neon Title",
            preview: null,
            slug: "neon",
            type: "component",
          },
        ],
        prompt: "open with [Asset #1]",
      }),
      "copied into the project: src/library/neon/Neon.tsx"
    );

    expect(content).toEqual([
      { text: "open with [Asset #1]", type: "text" },
      {
        text: "copied into the project: src/library/neon/Neon.tsx",
        type: "text",
      },
    ]);
  });

  it("keeps an asset reference in the sentence rather than splicing it", async () => {
    const content = await contentOf(
      params({
        assets: [
          {
            name: "Neon Title",
            preview: null,
            slug: "neon",
            type: "component",
          },
        ],
        attachments: [attachment()],
        prompt: "like [Image #1], open with [Asset #1]",
      }),
      "the asset block"
    );

    expect(content).toEqual([
      { text: "like ", type: "text" },
      SHOT,
      { text: ", open with [Asset #1]", type: "text" },
      { text: "the asset block", type: "text" },
    ]);
  });

  it("stays a plain string when an asset was picked but nothing was copied", async () => {
    expect(
      await contentOf(
        params({
          assets: [
            {
              name: "Neon Title",
              preview: null,
              slug: "neon",
              type: "component",
            },
          ],
          prompt: "open with [Asset #1]",
        })
      )
    ).toBe("open with [Asset #1]");
  });
});
