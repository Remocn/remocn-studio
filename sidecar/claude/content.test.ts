import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PromptParams } from "@/shared/ipc";
import { contentOf } from "@/sidecar/claude/content";

let shot = "";

function params(shape: Partial<PromptParams>): PromptParams {
  return {
    attachments: [],
    cwd: "/tmp/project",
    effort: null,
    historyId: null,
    model: null,
    prompt: "",
    sessionId: null,
    ...shape,
  };
}

function attachment() {
  return { mediaType: "image/png", name: "shot.png", path: shot } as const;
}

describe("contentOf", () => {
  beforeAll(async () => {
    const folder = await mkdtemp(join(tmpdir(), "remocn-content-"));
    shot = join(folder, "shot.png");
    await writeFile(shot, "hi");
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
});
