import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit, Scope } from "effect";
import { JOB_BASE, makeJobRegistry } from "./job";
import type { NativeBuild } from "./native";
import { RENDER_BASE } from "./protocol";
import { serve } from "./server";

const made: string[] = [];

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

function scratch(): string {
  const created = mkdtempSync(path.join(tmpdir(), "remocn-server-"));
  made.push(created);
  return created;
}

interface Answered {
  body: string;
  status: number;
}

// happy-dom's `fetch` refuses a cross-origin read, and every request here is
// one: the page under test is `about:blank`. `node:http` is what the render
// browser would use anyway.
function get(
  port: number,
  pathname: string,
  headers: Record<string, string> = {}
): Promise<Answered> {
  return new Promise((resolve, reject) => {
    const asking = request(
      { headers, host: "127.0.0.1", path: pathname, port },
      (answer) => {
        let body = "";
        answer.setEncoding("utf8");
        answer.on("data", (chunk: string) => {
          body += chunk;
        });
        answer.on("end", () =>
          resolve({ body, status: answer.statusCode ?? 0 })
        );
      }
    );

    asking.on("error", reject);
    asking.end();
  });
}

interface Standing {
  close: () => Promise<void>;
  get: (
    pathname: string,
    headers?: Record<string, string>
  ) => Promise<Answered>;
  jobs: ReturnType<typeof makeJobRegistry>;
  nativeDir: string;
  outDir: string;
  publicDir: string;
}

const NATIVE_BASE = "/native-test";

async function standing(
  built: () => NativeBuild | null = () => null
): Promise<Standing> {
  const root = scratch();
  const outDir = path.join(root, "bundle");
  const nativeDir = path.join(root, "native");
  const publicDir = path.join(root, "public");
  const jobs = makeJobRegistry();

  mkdirSync(outDir, { recursive: true });
  mkdirSync(nativeDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(outDir, "bundle.js"), "the live build");
  writeFileSync(path.join(publicDir, "logo.png"), "the live logo");

  const scope = Effect.runSync(Scope.make());

  const server = await Effect.runPromise(
    Effect.provideService(
      serve({
        jobs,
        native: () => ({
          base: NATIVE_BASE,
          directory: nativeDir,
          prepare: Effect.succeed(1),
          script: built,
          start: Effect.void,
        }),
        outDir,
        preferred: null,
        previewBase: "/preview-test",
        proxies: null,
        publicDir,
        root,
        staticBase: "/static-test",
        title: "test",
        version: "4.0.520",
      }),
      Scope.Scope,
      scope
    )
  );

  return {
    close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    get: (pathname, headers) => get(server.port, pathname, headers),
    jobs,
    nativeDir,
    outDir,
    publicDir,
  };
}

describe("the preview server", () => {
  it("serves a pinned job's own bundle rather than the live one", async () => {
    const server = await standing();
    const pinnedDir = scratch();

    writeFileSync(path.join(pinnedDir, "bundle.js"), "the pinned build");

    server.jobs.add({
      base: `${JOB_BASE}/abc`,
      id: "abc",
      outDir: pinnedDir,
      publicDir: null,
      staticBase: "/pinned-abc",
    });

    const live = await server.get(`${RENDER_BASE}/bundle.js`);
    const pinned = await server.get(`${JOB_BASE}/abc/bundle.js`);

    expect(live.body).toBe("the live build");
    expect(pinned.body).toBe("the pinned build");

    await server.close();
  });

  it("serves a job's page against its own static base", async () => {
    const server = await standing();

    server.jobs.add({
      base: `${JOB_BASE}/abc`,
      id: "abc",
      outDir: server.outDir,
      publicDir: null,
      staticBase: "/pinned-abc",
    });

    const page = (await server.get(`${JOB_BASE}/abc/index.html`)).body;

    expect(page).toContain('window.remotion_staticBase = "/pinned-abc"');
    expect(page).toContain('id="video-container"');

    await server.close();
  });

  it("serves a job's own copy of public/", async () => {
    const server = await standing();
    const pinnedPublic = scratch();

    writeFileSync(path.join(pinnedPublic, "logo.png"), "the pinned logo");

    server.jobs.add({
      base: `${JOB_BASE}/abc`,
      id: "abc",
      outDir: server.outDir,
      publicDir: pinnedPublic,
      staticBase: "/pinned-abc",
    });

    const live = await server.get("/static-test/logo.png");
    const pinned = await server.get("/pinned-abc/logo.png");

    expect(live.body).toBe("the live logo");
    expect(pinned.body).toBe("the pinned logo");

    await server.close();
  });

  it("answers the canvas bundle from the copy of its build, not from the file being rewritten", async () => {
    const server = await standing(() => ({
      generation: 1,
      script: new TextEncoder().encode("the whole build"),
    }));

    writeFileSync(path.join(server.nativeDir, "bundle.js"), "the next bu");
    writeFileSync(path.join(server.nativeDir, "bundle.js.map"), "its map");

    const script = await server.get(`${NATIVE_BASE}/bundle.js?generation=1`);
    const map = await server.get(`${NATIVE_BASE}/bundle.js.map`);

    expect(script).toEqual({ body: "the whole build", status: 200 });
    expect(map.body).toBe("its map");

    await server.close();
  });

  it("answers a range of the canvas bundle's copy", async () => {
    const server = await standing(() => ({
      generation: 1,
      script: new TextEncoder().encode("the whole build"),
    }));

    const answered = await server.get(`${NATIVE_BASE}/bundle.js`, {
      range: "bytes=4-8",
    });

    expect(answered).toEqual({ body: "whole", status: 206 });

    await server.close();
  });

  it("has no canvas bundle to answer before a build has compiled", async () => {
    const server = await standing();

    writeFileSync(path.join(server.nativeDir, "bundle.js"), "a failed build");

    const answered = await server.get(`${NATIVE_BASE}/bundle.js`);

    expect(answered.status).toBe(404);

    await server.close();
  });

  it("answers a job it has never heard of rather than falling through", async () => {
    const server = await standing();

    const answered = await server.get(`${JOB_BASE}/gone/bundle.js`);

    expect(answered.status).toBe(404);

    await server.close();
  });
});
