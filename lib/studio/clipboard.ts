import { invoke } from "@tauri-apps/api/core";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { isImageMediaType } from "./attachments";

export class ClipboardError extends Data.TaggedError("ClipboardError")<{
  message: string;
}> {}

export function imageFilesOf(data: DataTransfer | null): File[] {
  if (data === null) {
    return [];
  }

  return Array.from(data.files ?? []).filter((file) =>
    isImageMediaType(file.type)
  );
}

export function saveImages(
  files: readonly File[]
): Effect.Effect<string[], ClipboardError> {
  return Effect.forEach(files, saveImage);
}

function saveImage(file: File): Effect.Effect<string, ClipboardError> {
  return Effect.tryPromise({
    catch: (cause) => new ClipboardError({ message: errorMessage(cause) }),
    try: async () =>
      invoke<string>("save_pasted_image", await file.arrayBuffer(), {
        headers: {
          "x-image-name": encodeURIComponent(file.name),
          "x-image-type": file.type,
        },
      }),
  });
}
