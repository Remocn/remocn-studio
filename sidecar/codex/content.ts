import type { Input, UserInput } from "@openai/codex-sdk";
import type { PromptParams } from "@/shared/ipc";
import { elementsOf, partsOf } from "../agent/prompt";

// The same splice contentOf performs for Claude, minus the base64: Codex
// takes images as local paths, so the bytes never leave the disk at all.
export function inputOf(
  params: PromptParams,
  ...appended: readonly (string | null)[]
): Input {
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

  const inputs: UserInput[] = parts.map((part) =>
    part.kind === "text"
      ? { text: part.text, type: "text" }
      : { path: params.attachments[part.index].path, type: "local_image" }
  );

  for (const trailer of trailers) {
    inputs.push({ text: trailer, type: "text" });
  }

  return inputs.length === 0 ? params.prompt : inputs;
}
