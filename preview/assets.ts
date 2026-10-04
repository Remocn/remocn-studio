import { surface, surfaceHref } from "./surface";

/**
 * What an `asset` field's value is, on each side of the wire.
 *
 * Remotion's own `asset` fields — `<Interactive.Img src>` and its siblings —
 * hold whatever `staticFile()` returned, which is the page's static base plus
 * the file's name, percent-encoded segment by segment. That URL is the wrong
 * thing to carry: it is relative to a page the app is not, and its base is a
 * per-host random path that has no business in a request to the agent. So the
 * pane holds the *name* — `bg.png`, `library/clip.png` — and this module is
 * the only place the two are converted into each other.
 */

// The host's own listing route. Spelled here as well as in
// `sidecar/preview/server.ts` for the reason the bridge's message shape is
// spelled twice: this file is compiled by the *project's* webpack and has no
// access to the app's module graph.
const STATICS_PATH = "/__remocn/static-files";
const SCHEME = /^[a-z][a-z\d+\-.]*:/i;
const IMAGE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function staticBase(): string {
  return surface().assets;
}

/** Where the app can reach the project's static files, origin and all. */
export function assetBase(base: string, href: string): string | null {
  if (base.length === 0) {
    return null;
  }

  try {
    return new URL(`${base}/`, href).href;
  } catch {
    return null;
  }
}

/** The name behind a value, or the value itself when it names no static file. */
export function assetName(value: string, base: string): string {
  const prefix = `${base}/`;

  if (base.length === 0 || !value.startsWith(prefix)) {
    return value;
  }

  return decodeSegments(value.slice(prefix.length));
}

/**
 * What the runtime is handed for a name. A value that is already a URL — a
 * remote image the project loads over https — is passed through untouched.
 */
export function assetValue(name: string): string {
  if (name.length === 0 || SCHEME.test(name) || name.startsWith("/")) {
    return name;
  }

  return `${staticBase()}/${encodeSegments(name)}`;
}

export function isImageName(name: string): boolean {
  return IMAGE.test(name);
}

function encodeSegments(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

function decodeSegments(name: string): string {
  try {
    return name.split("/").map(decodeURIComponent).join("/");
  } catch {
    return name;
  }
}

let listing: Promise<readonly string[]> | null = null;

/**
 * The pictures already in the project's `public/`, for the pane to offer.
 *
 * Asked for once per page and awaited by the pick that needs it — a selection
 * is already asynchronous, and a listing that arrived a frame late would leave
 * the picker empty with nothing to say why. A rebuild forgets it, because the
 * turn that caused the rebuild is exactly what adds pictures.
 */
export function assetNames(): Promise<readonly string[]> {
  listing ??= fetchNames();

  return listing;
}

export function forgetAssets(): void {
  listing = null;
}

async function fetchNames(): Promise<readonly string[]> {
  try {
    const response = await fetch(new URL(STATICS_PATH, surfaceHref()));
    const { files }: { files?: unknown } = await response.json();

    return Array.isArray(files)
      ? files.filter(
          (name): name is string =>
            typeof name === "string" && isImageName(name)
        )
      : [];
  } catch {
    // The picker offering nothing is the honest answer to a host that could
    // not be asked; nothing here is worth failing a selection over.
    return [];
  }
}
