import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { AssetType } from "@/shared/library";

export class ThumbnailError extends Data.TaggedError("ThumbnailError")<{
  message: string;
}> {}

export const THUMBNAIL_EDGE = 640;

const SEEK_SECONDS = 0.1;
const DECODE_TIMEOUT = "15 seconds";
const WAVEFORM_BARS = 96;
const WAVEFORM_STEP = 6;
const WAVEFORM_HEIGHT = 180;
const WAVEFORM_INK = "#5eead4";

export interface ThumbnailSize {
  height: number;
  width: number;
}

export function thumbnailSize(
  width: number,
  height: number,
  max = THUMBNAIL_EDGE
): ThumbnailSize {
  const longest = Math.max(width, height);

  if (!(Number.isFinite(longest) && longest > 0)) {
    return { height: 0, width: 0 };
  }

  const scale = longest > max ? max / longest : 1;

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

// A frame a tenth of a second in, not frame zero: seeking to a time the video
// already sits at fires no `seeked`, and plenty of encodings open on black.
export function firstFrameAt(duration: number): number {
  return Number.isFinite(duration) && duration > 0
    ? Math.min(SEEK_SECONDS, duration / 2)
    : SEEK_SECONDS;
}

export interface Still {
  duration: number | null;
  file: File;
}

// One still per kind of media: a video shows a frame, a sound shows its shape.
// Both end up as the same stored `preview.png`, so everything downstream — the
// manifest field, the backfill, the card — is written once.
export function stillFor(
  type: AssetType,
  url: string,
  name: string
): Effect.Effect<Still, ThumbnailError> {
  if (type === "video") {
    return bounded(() => grab(url, name), name);
  }

  if (type === "audio") {
    return bounded(() => draw(url, name), name);
  }

  return Effect.fail(
    new ThumbnailError({ message: `${name} is not media with a still.` })
  );
}

export function firstFrame(
  url: string,
  name: string
): Effect.Effect<Still, ThumbnailError> {
  return bounded(() => grab(url, name), name);
}

function bounded(
  run: () => Promise<Still>,
  name: string
): Effect.Effect<Still, ThumbnailError> {
  return Effect.tryPromise({
    catch: (cause) => new ThumbnailError({ message: errorMessage(cause) }),
    try: run,
  }).pipe(
    Effect.timeout(DECODE_TIMEOUT),
    Effect.catch((cause) =>
      Effect.fail(
        cause instanceof ThumbnailError
          ? cause
          : new ThumbnailError({
              message: `${name} did not decode within ${DECODE_TIMEOUT}.`,
            })
      )
    )
  );
}

async function grab(url: string, name: string): Promise<Still> {
  const video = document.createElement("video");

  // The asset protocol is a different origin from the window, so a plain load
  // taints the canvas and toBlob() throws — the same trap a snapshot hits.
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  const painted = new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () =>
      reject(new Error(`${name} could not be decoded by the app.`));
    video.onloadeddata = () => {
      video.currentTime = firstFrameAt(video.duration);
    };
  });

  video.src = url;

  try {
    await painted;

    return {
      duration: Number.isFinite(video.duration) ? video.duration : null,
      file: await paint(video, name),
    };
  } finally {
    video.onseeked = null;
    video.onerror = null;
    video.onloadeddata = null;
    video.removeAttribute("src");
    video.load();
  }
}

// One bar per slice, each the loudest sample in it, normalised so a quiet
// recording still fills the tile rather than reading as a flat line.
export function peaksFrom(samples: ArrayLike<number>, count: number): number[] {
  if (count <= 0 || samples.length === 0) {
    return [];
  }

  const width = samples.length / count;
  const peaks: number[] = [];
  let loudest = 0;

  for (let bar = 0; bar < count; bar += 1) {
    const from = Math.floor(bar * width);
    const to = Math.min(
      samples.length,
      Math.floor((bar + 1) * width) || from + 1
    );

    let peak = 0;
    for (let at = from; at < to; at += 1) {
      const level = Math.abs(samples[at] ?? 0);
      if (level > peak) {
        peak = level;
      }
    }

    loudest = Math.max(loudest, peak);
    peaks.push(peak);
  }

  return loudest === 0 ? peaks : peaks.map((peak) => peak / loudest);
}

async function draw(url: string, name: string): Promise<Still> {
  const Context = window.AudioContext;
  if (Context === undefined) {
    throw new Error("This window cannot decode sound.");
  }

  const bytes = await fetch(url).then((answer) => answer.arrayBuffer());
  const context = new Context();

  try {
    const sound = await context.decodeAudioData(bytes);
    const peaks = peaksFrom(sound.getChannelData(0), WAVEFORM_BARS);

    return { duration: sound.duration, file: bars(peaks, name) };
  } finally {
    await context.close().catch(ignore);
  }
}

function bars(peaks: readonly number[], name: string): File {
  const canvas = document.createElement("canvas");
  canvas.height = WAVEFORM_HEIGHT;
  canvas.width = WAVEFORM_BARS * WAVEFORM_STEP;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("This window has no 2d canvas to draw the sound on.");
  }

  // Baked into the picture, so the colour has to read on both themes rather
  // than following one — a mid tone against the card's muted background.
  context.fillStyle = WAVEFORM_INK;

  for (const [bar, peak] of peaks.entries()) {
    const height = Math.max(2, peak * WAVEFORM_HEIGHT);
    context.fillRect(
      bar * WAVEFORM_STEP,
      (WAVEFORM_HEIGHT - height) / 2,
      WAVEFORM_STEP - 1,
      height
    );
  }

  return new File([dataOf(canvas)], `${name}.png`, { type: "image/png" });
}

function dataOf(canvas: HTMLCanvasElement): Uint8Array {
  const [, encoded] = canvas.toDataURL("image/png").split(",");
  const binary = atob(encoded ?? "");

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

const ignore = (): undefined => undefined;

async function paint(video: HTMLVideoElement, name: string): Promise<File> {
  const size = thumbnailSize(video.videoWidth, video.videoHeight);

  if (size.width === 0) {
    throw new Error(`${name} reported no picture to take a frame from.`);
  }

  const canvas = document.createElement("canvas");
  canvas.height = size.height;
  canvas.width = size.width;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("This window has no 2d canvas to draw the frame on.");
  }

  context.drawImage(video, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (blob === null) {
    throw new Error(`The frame taken from ${name} could not be encoded.`);
  }

  return new File([blob], `${name}.png`, { type: "image/png" });
}
