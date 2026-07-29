import { readFile } from "node:fs/promises";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  PromptAttachment,
  PromptElement,
  PromptParams,
} from "@/shared/ipc";
import { referenceOf, segmentsOf } from "@/shared/references";

const MARKUP_LIMIT = 2000;

type Content = SDKUserMessage["message"]["content"];

type Part = { index: number; kind: "image" } | { kind: "text"; text: string };

export async function contentOf(params: PromptParams): Promise<Content> {
  const trailer = elementsOf(params.elements);

  if (params.attachments.length === 0 && trailer === null) {
    return params.prompt;
  }

  const parts = partsOf(
    params.prompt,
    params.attachments.length,
    params.elements.length
  );
  const blocks: Exclude<Content, string> = await Promise.all(
    parts.map((part) => blockOf(part, params.attachments))
  );

  if (trailer !== null) {
    blocks.push({ text: trailer, type: "text" });
  }

  return blocks.length === 0 ? params.prompt : blocks;
}

function elementsOf(elements: readonly PromptElement[]): string | null {
  if (elements.length === 0) {
    return null;
  }

  const blocks = elements.map((element, index) => describe(element, index));

  return `The elements referenced above, each picked in the running preview:\n\n${blocks.join("\n\n")}`;
}

function describe(element: PromptElement, index: number): string {
  const lines = [
    referenceOf("element", index),
    `file: ${where(element)}`,
    `component: ${element.component ?? "unknown"}`,
    `composition: ${element.composition}, frame ${element.frame}`,
  ];

  if (element.scene !== null) {
    const { durationInFrames, frame, from, name } = element.scene;
    const called = name.length > 0 ? `${name}, ` : "";
    lines.push(
      `scene: ${called}from frame ${from} for ${durationInFrames} frames, at frame ${frame} within it`
    );
  }

  if (element.stack.length > 0) {
    lines.push(`rendered through: ${element.stack.join(" ← ")}`);
  }

  lines.push(`markup: ${truncate(element.html)}`);

  return lines.join("\n");
}

function where(element: PromptElement): string {
  if (element.file === null) {
    return "unresolved — no source location for this element";
  }

  return [element.file, element.line, element.column]
    .filter((part) => part !== null)
    .join(":");
}

function truncate(html: string): string {
  return html.length <= MARKUP_LIMIT ? html : `${html.slice(0, MARKUP_LIMIT)}…`;
}

function partsOf(prompt: string, images: number, elements: number): Part[] {
  const spliced: Part[] = [];
  const referenced = new Set<number>();
  let buffer = "";

  const flush = () => {
    if (buffer.length > 0) {
      spliced.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  for (const segment of segmentsOf(prompt, {
    element: elements,
    image: images,
  })) {
    const spliceable =
      segment.kind === "reference" &&
      segment.reference === "image" &&
      !referenced.has(segment.index);

    if (!spliceable) {
      buffer += segment.text;
      continue;
    }

    flush();
    referenced.add(segment.index);
    spliced.push({ index: segment.index, kind: "image" });
  }

  flush();

  const unreferenced = Array.from({ length: images }, (_, index) => index)
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
