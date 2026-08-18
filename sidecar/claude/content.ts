import { readFile } from "node:fs/promises";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, PromptParams } from "@/shared/ipc";
import { elementsOf, type PromptPart, partsOf } from "../agent/prompt";

type Content = SDKUserMessage["message"]["content"];

export async function contentOf(
  params: PromptParams,
  ...appended: readonly (string | null)[]
): Promise<Content> {
  const trailers = [elementsOf(params.elements), ...appended].filter(
    (trailer): trailer is string => trailer !== null
  );

  if (params.attachments.length === 0 && trailers.length === 0) {
    return params.prompt;
  }

  const parts = partsOf(params.prompt, params.attachments.length, {
    asset: params.assets.length,
    element: params.elements.length,
  });
  const blocks: Exclude<Content, string> = await Promise.all(
    parts.map((part) => blockOf(part, params.attachments))
  );

  for (const trailer of trailers) {
    blocks.push({ text: trailer, type: "text" });
  }

  return blocks.length === 0 ? params.prompt : blocks;
}

async function blockOf(
  part: PromptPart,
  attachments: readonly PromptAttachment[]
) {
  return part.kind === "text"
    ? ({ text: part.text, type: "text" } as const)
    : await imageBlock(attachments[part.index]);
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
