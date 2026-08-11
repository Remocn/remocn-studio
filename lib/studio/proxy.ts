import { invoke } from "@tauri-apps/api/core";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { PROXY_HEIGHT } from "@/shared/library";

export class ProxyError extends Data.TaggedError("ProxyError")<{
  message: string;
}> {}

const METADATA_TIMEOUT = "20 seconds";
const CODEC = "avc1.640028";
const BITRATE = 8_000_000;
const FRAMERATE = 30;

let encodable: Promise<boolean> | null = null;

// Measured in Safari 26.5, which is the same WebKit the app window runs: the
// encoder is there and configures for hardware h264 at 1080p. Asked again here
// rather than assumed, because a WKWebView is not literally a Safari tab and a
// missing encoder must read as "no proxy" — quietly, with the original still
// playing — instead of as a failure.
export function canEncode(): Effect.Effect<boolean, never> {
  return Effect.promise(() => {
    encodable ??= probe();
    return encodable;
  });
}

async function probe(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") {
    return false;
  }

  try {
    const support = await VideoEncoder.isConfigSupported({
      bitrate: BITRATE,
      codec: CODEC,
      framerate: FRAMERATE,
      height: PROXY_HEIGHT,
      width: (PROXY_HEIGHT * 16) / 9,
    });

    return support.supported === true;
  } catch {
    return false;
  }
}

// Only the height, and only from the metadata: deciding whether a file is worth
// re-encoding must not cost a decode of it.
export function heightOf(
  url: string,
  name: string
): Effect.Effect<number, ProxyError> {
  return Effect.tryPromise({
    catch: (cause) => new ProxyError({ message: errorMessage(cause) }),
    try: () => measure(url, name),
  }).pipe(
    Effect.timeout(METADATA_TIMEOUT),
    Effect.catch((cause) =>
      Effect.fail(
        cause instanceof ProxyError
          ? cause
          : new ProxyError({
              message: `${name} did not report its size within ${METADATA_TIMEOUT}.`,
            })
      )
    )
  );
}

function measure(url: string, name: string): Promise<number> {
  const video = document.createElement("video");

  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "metadata";

  const measured = new Promise<number>((resolve, reject) => {
    video.onloadedmetadata = () => resolve(video.videoHeight);
    video.onerror = () =>
      reject(new Error(`${name} could not be read by the app.`));
  });

  video.src = url;

  return measured.finally(() => {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute("src");
    video.load();
  });
}

// Handing `convertMedia` the asset URL failed on every clip, with the URL itself
// as the message: media-parser fetches what it is given, and Tauri's custom
// scheme is not something it can read that way — an element load is, which is
// why the thumbnails off these same paths were fine. Read the bytes here instead
// and pass a Blob, which media-parser slices without going near the network.
export function sourceFor(url: string): Effect.Effect<Blob, ProxyError> {
  return Effect.tryPromise({
    catch: (cause) => new ProxyError({ message: errorMessage(cause) }),
    try: async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`the asset protocol answered ${response.status}`);
      }

      return await response.blob();
    },
  });
}

// Imported where it is used rather than at module scope: 1.4MB of decoder and
// muxer belong in their own chunk, not in the bundle that draws the first frame
// of the app.
export function proxyFor(source: Blob): Effect.Effect<Blob, ProxyError> {
  return Effect.tryPromise({
    catch: (cause) => new ProxyError({ message: errorMessage(cause) }),
    try: async () => {
      const { convertMedia } = await import("@remotion/webcodecs");

      const converted = await convertMedia({
        container: "mp4",
        resize: { maxHeight: PROXY_HEIGHT, mode: "max-height" },
        src: source,
        videoCodec: "h264",
      });

      return await converted.save();
    },
  });
}

// The bytes reach disk as a raw body, for the same reason a pasted image does —
// and the core picks where, as it does for everything else the webview produces.
export function saveProxy(
  slug: string,
  proxy: Blob
): Effect.Effect<string, ProxyError> {
  return Effect.tryPromise({
    catch: (cause) => new ProxyError({ message: errorMessage(cause) }),
    try: async () =>
      invoke<string>("save_proxy", await proxy.arrayBuffer(), {
        headers: { "x-proxy-slug": encodeURIComponent(slug) },
      }),
  });
}
