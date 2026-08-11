import { createReadStream, existsSync, type Stats, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { etagOf, matches } from "./caching";
import { GRAB_PATH } from "./grab";
import { previewPage, renderPage } from "./html";
import { PreviewError } from "./project";
import { RENDER_BASE } from "./protocol";
import type { Proxies } from "./proxies";
import { byteRange, UNSATISFIABLE } from "./range";

export const HOT_PATH = "/__remocn/hot";

const FRESH = "no-store";
const REVALIDATED = "no-cache";

type Caching = typeof FRESH | typeof REVALIDATED;

const LEADING_SLASH = /^\//;

const MIME: Record<string, string> = {
  ".aac": "audio/aac",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".m4v": "video/mp4",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface PreviewServer {
  readonly notifyRebuilt: () => void;
  readonly port: number;
}

export interface ServerOptions {
  grab: string | null;
  outDir: string;
  preferred: string | null;
  previewBase: string;
  proxies: Proxies | null;
  publicDir: string;
  root: string;
  staticBase: string;
  title: string;
  version: string;
}

interface Delivery {
  caching: Caching;
  substitute: ((path: string, stats: Stats) => string | null) | null;
}

const BUNDLE: Delivery = { caching: FRESH, substitute: null };
const ORIGINAL: Delivery = { caching: REVALIDATED, substitute: null };

export function serve(
  options: ServerOptions
): Effect.Effect<PreviewServer, PreviewError, Scope.Scope> {
  return Effect.acquireRelease(start(options), (server) =>
    Effect.sync(() => server.close())
  );
}

function start(options: ServerOptions) {
  return Effect.callback<PreviewServer & { close: () => void }, PreviewError>(
    (resume) => {
      const listeners = new Set<ServerResponse>();

      const server = createServer((request, response) => {
        handle(options, listeners, request, response);
      });

      server.on("error", (cause) => {
        resume(Effect.fail(new PreviewError({ message: errorMessage(cause) })));
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          resume(
            Effect.fail(
              new PreviewError({ message: "the preview server has no port" })
            )
          );
          return;
        }

        resume(
          Effect.succeed({
            close: () => {
              for (const listener of listeners) {
                listener.end();
              }
              server.close();
            },
            notifyRebuilt: () => {
              for (const listener of listeners) {
                listener.write("event: rebuilt\ndata: {}\n\n");
              }
            },
            port: address.port,
          })
        );
      });
    }
  );
}

function handle(
  options: ServerOptions,
  listeners: Set<ServerResponse>,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === HOT_PATH) {
    openStream(listeners, response);
    return;
  }

  if (pathname === GRAB_PATH) {
    sendGrab(options.grab, response);
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    sendPage(previewPage(pageOptions(options, options.previewBase)), response);
    return;
  }

  if (isRenderPage(pathname)) {
    sendPage(renderPage(pageOptions(options, options.staticBase)), response);
    return;
  }

  if (pathname.startsWith(`${RENDER_BASE}/`)) {
    sendFile(
      options.outDir,
      pathname.slice(RENDER_BASE.length + 1),
      BUNDLE,
      request,
      response
    );
    return;
  }

  // The two bases differ in exactly one thing: what a video resolves to. The
  // render page — which is what an export and a snapshot load — is always given
  // the original, so the mp4 that leaves this app is never the proxy.
  if (pathname.startsWith(`${options.previewBase}/`)) {
    const relative = pathname.slice(options.previewBase.length + 1);
    sendFile(
      options.publicDir,
      relative,
      previewing(options),
      request,
      response
    );
    return;
  }

  if (pathname.startsWith(`${options.staticBase}/`)) {
    const relative = pathname.slice(options.staticBase.length + 1);
    sendFile(options.publicDir, relative, ORIGINAL, request, response);
    return;
  }

  sendFile(
    options.outDir,
    pathname.replace(LEADING_SLASH, ""),
    BUNDLE,
    request,
    response
  );
}

function previewing(options: ServerOptions): Delivery {
  const held = options.proxies;

  return held === null
    ? ORIGINAL
    : { caching: REVALIDATED, substitute: held.of };
}

function isRenderPage(pathname: string): boolean {
  return (
    pathname === RENDER_BASE ||
    pathname === `${RENDER_BASE}/` ||
    pathname === `${RENDER_BASE}/index.html`
  );
}

function pageOptions(options: ServerOptions, staticBase: string) {
  return {
    hasGrab: options.grab !== null,
    preferred: options.preferred,
    publicPath: "/",
    root: options.root,
    staticBase,
    title: options.title,
    version: options.version,
  };
}

function sendPage(body: string, response: ServerResponse): void {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
  });
  response.end(body);
}

function sendGrab(source: string | null, response: ServerResponse): void {
  if (source === null) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/javascript; charset=utf-8",
  });
  response.end(source);
}

function openStream(
  listeners: Set<ServerResponse>,
  response: ServerResponse
): void {
  response.writeHead(200, {
    "cache-control": "no-store",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  response.write("event: open\ndata: {}\n\n");
  listeners.add(response);
  response.on("close", () => {
    listeners.delete(response);
  });
}

const MISSING = Symbol("missing");

interface Found {
  stats: Stats;
  target: string;
  type: string;
}

// Null is outside the root, MISSING is not a file there. The proxy answers under
// the original's URL, with its own size and its own tag — so a clip whose proxy
// lands mid-session invalidates what the webview cached for it, rather than
// being pinned to whichever it saw first. The media type stays the original's:
// the URL is what the page asked for, and a proxy is always mp4 anyway.
function resolve(
  root: string,
  relative: string,
  delivery: Delivery
): Found | typeof MISSING | null {
  const asked = path.resolve(root, relative);
  const within = path.relative(root, asked);

  if (within.startsWith("..") || path.isAbsolute(within)) {
    return null;
  }

  if (!existsSync(asked)) {
    return MISSING;
  }

  const found = statSync(asked);

  if (!found.isFile()) {
    return MISSING;
  }

  const substituted = delivery.substitute?.(asked, found) ?? null;

  return {
    stats: substituted === null ? found : statSync(substituted),
    target: substituted ?? asked,
    type: MIME[path.extname(asked).toLowerCase()] ?? "application/octet-stream",
  };
}

function sendFile(
  root: string,
  relative: string,
  delivery: Delivery,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const found = resolve(root, relative, delivery);

  if (found === null) {
    response.writeHead(403).end();
    return;
  }

  if (found === MISSING) {
    response.writeHead(404).end();
    return;
  }

  const { stats, target, type } = found;
  const { caching } = delivery;
  const { size } = stats;
  const tag = caching === FRESH ? null : etagOf(stats);
  const validity: Record<string, string> =
    tag === null
      ? { "cache-control": FRESH }
      : { "cache-control": REVALIDATED, etag: tag };

  if (tag !== null && matches(request.headers["if-none-match"], tag)) {
    response.writeHead(304, validity).end();
    return;
  }

  const ifRange = request.headers["if-range"];
  const stale = tag !== null && ifRange !== undefined && ifRange !== tag;
  const range = byteRange(stale ? undefined : request.headers.range, size);

  if (range === UNSATISFIABLE) {
    response
      .writeHead(416, {
        "accept-ranges": "bytes",
        "content-range": `bytes */${size}`,
      })
      .end();
    return;
  }

  const from = range === null ? 0 : range.start;
  const to = range === null ? size - 1 : range.end;

  response.writeHead(range === null ? 200 : 206, {
    "accept-ranges": "bytes",
    "content-length": size === 0 ? 0 : to - from + 1,
    "content-type": type,
    ...validity,
    ...(range === null
      ? {}
      : { "content-range": `bytes ${from}-${to}/${size}` }),
  });

  if (request.method === "HEAD" || size === 0) {
    response.end();
    return;
  }

  createReadStream(target, { end: to, start: from }).pipe(response);
}
