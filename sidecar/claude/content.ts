import { readFile } from "node:fs/promises";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, PromptParams } from "@/shared/ipc";

type Content = SDKUserMessage["message"]["content"];

export async function contentOf(params: PromptParams): Promise<Content> {
  if (params.attachments.length === 0) {
    return params.prompt;
  }

  const images = await Promise.all(params.attachments.map(imageBlock));
  const text = params.prompt.trim();

  return text.length === 0 ? images : [...images, { text, type: "text" }];
}

async function imageBlock(attachment: PromptAttachment) {
  return {
    source: {
      data: await readFile(attachment.path, { encoding: "base64" }),
      media_type: attachment.mediaType,
      type: "base64",
    },
    type: "image",
  } as const;
}
