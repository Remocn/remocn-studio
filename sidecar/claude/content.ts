import { readFile } from "node:fs/promises";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, PromptParams } from "@/shared/ipc";
import { segmentsOf } from "@/shared/references";

type Content = SDKUserMessage["message"]["content"];

type Part = { index: number; kind: "image" } | { kind: "text"; text: string };

export async function contentOf(params: PromptParams): Promise<Content> {
  if (params.attachments.length === 0) {
    return params.prompt;
  }

  const parts = partsOf(params.prompt, params.attachments.length);
  const blocks = await Promise.all(
    parts.map((part) => blockOf(part, params.attachments))
  );

  return blocks.length === 0 ? params.prompt : blocks;
}

function partsOf(prompt: string, count: number): Part[] {
  const spliced: Part[] = [];
  const referenced = new Set<number>();
  let buffer = "";

  const flush = () => {
    if (buffer.length > 0) {
      spliced.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  for (const segment of segmentsOf(prompt, count)) {
    if (segment.kind === "text" || referenced.has(segment.index)) {
      buffer += segment.text;
      continue;
    }

    flush();
    referenced.add(segment.index);
    spliced.push({ index: segment.index, kind: "image" });
  }

  flush();

  const unreferenced = Array.from({ length: count }, (_, index) => index)
    .filter((index) => !referenced.has(index))
    .map((index): Part => ({ index, kind: "image" }));

  return [...unreferenced, ...trimEdges(spliced)].filter(
    (part) => part.kind === "image" || part.text.trim().length > 0
  );
}

function trimEdges(parts: Part[]): Part[] {
  const last = parts.length - 1;

  return parts.map((part, at) => {
    if (part.kind === "image") {
      return part;
    }

    const started = at === 0 ? part.text.trimStart() : part.text;
    return { kind: "text", text: at === last ? started.trimEnd() : started };
  });
}

async function blockOf(part: Part, attachments: readonly PromptAttachment[]) {
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
