import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { StillEvent } from "@/shared/ipc";
import { previewUrl } from "./attachments";
import { type PreviewRect, renderStill } from "./preview";
import type { SidecarError } from "./sidecar";

export class CaptureError extends Data.TaggedError("CaptureError")<{
  message: string;
}> {}

export const LONG_EDGE = 1568;

const MEDIA_TYPE = "image/png";

export interface CaptureSize {
  height: number;
  width: number;
}

export interface CaptureBox extends CaptureSize {
  x: number;
  y: number;
}

export function captureBox(
  rect: PreviewRect | null,
  size: CaptureSize
): CaptureBox {
  const width = Math.max(1, Math.trunc(size.width));
  const height = Math.max(1, Math.trunc(size.height));

  if (rect === null) {
    return { height, width, x: 0, y: 0 };
  }

  const x = Math.min(Math.round(share(rect.x) * width), width - 1);
  const y = Math.min(Math.round(share(rect.y) * height), height - 1);
  const right = Math.round(share(rect.x + rect.width) * width);
  const bottom = Math.round(share(rect.y + rect.height) * height);

  return {
    height: Math.max(1, Math.min(bottom - y, height - y)),
    width: Math.max(1, Math.min(right - x, width - x)),
    x,
    y,
  };
}

export function fitLongEdge(
  size: CaptureSize,
  limit: number = LONG_EDGE
): CaptureSize {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const longest = Math.max(width, height);

  if (longest <= limit) {
    return { height, width };
  }

  const scale = limit / longest;

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function stillName(composition: string, frame: number): string {
  const stem = composition
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${stem.length > 0 ? stem : "still"}-frame-${frame}.png`;
}

export interface SnapshotRequest {
  composition: string;
  frame: number;
  projectId: string;
  rect: PreviewRect | null;
}

export function takeSnapshot(
  request: SnapshotRequest,
  onEvent: (event: StillEvent) => void
): Effect.Effect<File, CaptureError | SidecarError> {
  return renderStill(
    {
      composition: request.composition,
      frame: request.frame,
      projectId: request.projectId,
    },
    onEvent
  ).pipe(
    Effect.flatMap((still) => {
      const url = previewUrl(still.path);

      if (url === null) {
        return Effect.fail(
          new CaptureError({
            message: "the rendered frame is not reachable from this window",
          })
        );
      }

      const box = captureBox(request.rect, still);

      return croppedImage({
        box,
        name: stillName(request.composition, request.frame),
        size: fitLongEdge(box),
        url,
      });
    })
  );
}

export function croppedImage(input: {
  box: CaptureBox;
  name: string;
  size: CaptureSize;
  url: string;
}): Effect.Effect<File, CaptureError> {
  return Effect.tryPromise({
    catch: (cause) => new CaptureError({ message: errorMessage(cause) }),
    try: async () => {
      const source = await loadImage(input.url);
      const canvas = document.createElement("canvas");

      canvas.width = input.size.width;
      canvas.height = input.size.height;

      const context = canvas.getContext("2d");

      if (context === null) {
        throw new Error("this webview cannot draw a snapshot");
      }

      context.drawImage(
        source,
        input.box.x,
        input.box.y,
        input.box.width,
        input.box.height,
        0,
        0,
        input.size.width,
        input.size.height
      );

      return new File([await encode(canvas)], input.name, {
        type: MEDIA_TYPE,
      });
    },
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("the rendered frame could not be read back"));
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("the snapshot could not be encoded"));
        return;
      }
      resolve(blob);
    }, MEDIA_TYPE);
  });
}

function share(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
