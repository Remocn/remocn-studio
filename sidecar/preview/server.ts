import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { GRAB_PATH } from "./grab";
import { previewPage } from "./html";
import { PreviewError } from "./project";

export const HOT_PATH = "/__remocn/hot";

const LEADING_SLASH = /^\//;

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
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
  publicDir: string;
  root: string;
  staticBase: string;
  title: string;
}

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
    const body = previewPage({
      hasGrab: options.grab !== null,
      preferred: options.preferred,
      publicPath: "/",
      root: options.root,
      staticBase: options.staticBase,
      title: options.title,
    });
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    });
    response.end(body);
    return;
  }

  if (pathname.startsWith(`${options.staticBase}/`)) {
    const relative = pathname.slice(options.staticBase.length + 1);
    sendFile(options.publicDir, relative, response);
    return;
  }

  sendFile(options.outDir, pathname.replace(LEADING_SLASH, ""), response);
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

function sendFile(
  root: string,
  relative: string,
  response: ServerResponse
): void {
  const target = path.resolve(root, relative);
  const within = path.relative(root, target);

  if (within.startsWith("..") || path.isAbsolute(within)) {
    response.writeHead(403).end();
    return;
  }

  if (!(existsSync(target) && statSync(target).isFile())) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type":
      MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
  });
  createReadStream(target).pipe(response);
}
