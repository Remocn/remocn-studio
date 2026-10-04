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
import { renderPage } from "./html";
import { type JobRegistry, jobPath, type Pinned } from "./job";
import {
  NATIVE_MANIFEST,
  NATIVE_SCRIPT,
  type NativeBuild,
  type NativeBundle,
} from "./native";
import { PreviewError } from "./project";
import { RENDER_BASE } from "./protocol";
import type { Proxies } from "./proxies";
import { byteRange, UNSATISFIABLE } from "./range";
import { staticFiles } from "./statics";

export const HOT_PATH = "/__remocn/hot";
export const STATICS_PATH = "/__remocn/static-files";

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
  readonly notifyNativeRebuilt: () => void;
  readonly notifyRebuilt: () => void;
  readonly port: number;
}

export interface ServerOptions {
  jobs: JobRegistry;
  native?: () => NativeBundle | null;
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
            notifyNativeRebuilt: () => {
              for (const listener of listeners) {
                listener.write("event: native-rebuilt\ndata: {}\n\n");
              }
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

  const { origin } = request.headers;
  if (origin && isStudioOrigin(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
  }

  if (pathname === NATIVE_MANIFEST) {
    const native = options.native?.();
    if (!native) {
      response
        .writeHead(503)
        .end(
          "The canvas preview is not ready. Restart the preview and try again."
        );
      return;
    }
    const address = request.socket.localPort;
    const base = `http://127.0.0.1:${address}`;
    Effect.runFork(
      Effect.match(native.prepare, {
        onFailure: () => {
          if (!response.destroyed) {
            response
              .writeHead(503)
              .end(
                "The canvas preview could not compile. Check the project output, then retry."
              );
          }
        },
        onSuccess: (generation) => {
          if (response.destroyed) {
            return;
          }
          sendJson(
            {
              assets: `${base}${options.previewBase}`,
              events: `${base}${HOT_PATH}`,
              generation,
              preferred: options.preferred,
              project: options.root,
              script: `${base}${native.base}/bundle.js?generation=${generation}`,
              version: 1,
            },
            response
          );
        },
      })
    );
    return;
  }

  const native = options.native?.();
  if (native && pathname.startsWith(`${native.base}/`)) {
    const relative = pathname.slice(native.base.length + 1);
    if (relative === NATIVE_SCRIPT) {
      sendScript(native.script(), request, response);
    } else {
      sendFile(native.directory, relative, BUNDLE, request, response);
    }
    return;
  }

  if (pathname === HOT_PATH) {
    openStream(listeners, response);
    return;
  }

  // Read per request rather than at start-up: the agent adds pictures to
  // `public/` during a session, and the picker that reads this is opened long
  // after the host began serving.
  if (pathname === STATICS_PATH) {
    sendJson(staticFiles(options.publicDir), response);
    return;
  }

  if (isRenderPage(pathname)) {
    sendPage(renderPage(pageOptions(options, options.staticBase)), response);
    return;
  }

  if (servePinned(options, pathname, request, response)) {
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

function isStudioOrigin(origin: string): boolean {
  if (origin === "tauri://localhost") {
    return true;
  }
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "tauri.localhost"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

// A render job is served from a copy of the bundle and of public/, taken when
// the job started: an agent saving a file mid-render rebuilds what the pane is
// watching, never the frames the encoder is still asking for.
function servePinned(
  options: ServerOptions,
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse
): boolean {
  const asked = jobPath(pathname);

  if (asked !== null) {
    const job = options.jobs.of(asked.id);

    if (job === null) {
      response.writeHead(404).end();
      return true;
    }

    sendJob(options, job, asked.rest, request, response);
    return true;
  }

  const owner = options.jobs.byStatic(pathname);

  if (owner === null) {
    return false;
  }

  sendFile(
    owner.publicDir ?? options.publicDir,
    pathname.slice(owner.staticBase.length + 1),
    ORIGINAL,
    request,
    response
  );

  return true;
}

function sendJob(
  options: ServerOptions,
  job: Pinned,
  rest: string,
  request: IncomingMessage,
  response: ServerResponse
): void {
  if (rest === "" || rest === "index.html") {
    sendPage(renderPage(pageOptions(options, job.staticBase)), response);
    return;
  }

  sendFile(job.outDir, rest, BUNDLE, request, response);
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
    publicPath: "/",
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

// The canvas runtime is answered from the copy taken when webpack finished
// writing it, never from disk: a rebuild rewrites the file in place, and the
// pane is told to fetch exactly while the next one may already be under way.
function sendScript(
  build: NativeBuild | null,
  request: IncomingMessage,
  response: ServerResponse
): void {
  if (build === null) {
    response.writeHead(404).end();
    return;
  }

  const { script } = build;

  sendBody(
    { size: script.byteLength, tag: null, type: MIME[".js"] },
    request,
    response,
    (from, to) => response.end(script.subarray(from, to + 1))
  );
}

function sendJson(body: unknown, response: ServerResponse): void {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
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
  const tag = delivery.caching === FRESH ? null : etagOf(stats);

  sendBody({ size: stats.size, tag, type }, request, response, (from, to) =>
    createReadStream(target, { end: to, start: from }).pipe(response)
  );
}

interface Body {
  size: number;
  tag: string | null;
  type: string;
}

function sendBody(
  body: Body,
  request: IncomingMessage,
  response: ServerResponse,
  write: (from: number, to: number) => void
): void {
  const { size, tag, type } = body;
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

  write(from, to);
}
