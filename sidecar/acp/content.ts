import { readFile } from "node:fs/promises";
import type { PromptParams } from "@/shared/ipc";
import { elementsOf, partsOf } from "../agent/prompt";

export type AcpBlock =
  | { data: string; mimeType: string; type: "image" }
  | { text: string; type: "text" };

// The same splice contentOf performs for Claude: ACP prompt blocks carry
// images as base64, so this is the one adapter family that still reads the
// bytes — the protocol has no path-shaped image block.
export async function blocksOf(
  params: PromptParams,
  ...appended: readonly (string | null)[]
): Promise<AcpBlock[]> {
  const trailers = [elementsOf(params.elements), ...appended].filter(
    (trailer): trailer is string => trailer !== null
  );

  const parts = partsOf(params.prompt, params.attachments.length, {
    asset: params.assets.length,
    element: params.elements.length,
  });

  const blocks: AcpBlock[] = await Promise.all(
    parts.map(async (part): Promise<AcpBlock> => {
      if (part.kind === "text") {
        return { text: part.text, type: "text" };
      }

      const attachment = params.attachments[part.index];
      return {
        data: await readFile(attachment.path, { encoding: "base64" }),
        mimeType: attachment.mediaType,
        type: "image",
      };
    })
  );

  for (const trailer of trailers) {
    blocks.push({ text: trailer, type: "text" });
  }

  return blocks.length === 0 ? [{ text: params.prompt, type: "text" }] : blocks;
}
