// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { configFile, entryPointOf, remotionRootOf } from "./project";

const made: string[] = [];

function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "remocn-preview-"));
  made.push(root);

  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  return root;
}

afterEach(() => {
  for (const root of made.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("configFile", () => {
  it("finds a TypeScript config", () => {
    const root = project({ "remotion.config.ts": "" });
    expect(configFile(root)).toBe(path.join(root, "remotion.config.ts"));
  });

  it("finds a JavaScript config", () => {
    const root = project({ "remotion.config.js": "" });
    expect(configFile(root)).toBe(path.join(root, "remotion.config.js"));
  });

  it("prefers TypeScript when both exist", () => {
    const root = project({
      "remotion.config.js": "",
      "remotion.config.ts": "",
    });
    expect(configFile(root)).toBe(path.join(root, "remotion.config.ts"));
  });

  it("is null when a project carries no config", () => {
    expect(configFile(project({ "package.json": "{}" }))).toBeNull();
  });
});

describe("entryPointOf", () => {
  it("falls back to Remotion's conventional paths without the CLI installed", async () => {
    const root = project({ "src/remotion/index.ts": "" });

    const entry = await Effect.runPromise(entryPointOf(root));

    expect(entry).toBe(path.join(root, "src/remotion/index.ts"));
  });

  it("prefers src/index.ts over the nested conventions", async () => {
    const root = project({
      "src/index.ts": "",
      "src/remotion/index.ts": "",
    });

    const entry = await Effect.runPromise(entryPointOf(root));

    expect(entry).toBe(path.join(root, "src/index.ts"));
  });

  it("names the conventions it looked for when a folder has none", async () => {
    const root = project({ "package.json": "{}" });

    const exit = await Effect.runPromiseExit(entryPointOf(root));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("no Remotion entry point");
  });
});

describe("remotionRootOf", () => {
  it("keeps a folder that is itself the project", () => {
    const root = project({ "package.json": "{}", "src/index.ts": "" });

    expect(remotionRootOf(root)).toBe(root);
  });

  it("climbs to the project when a scene folder is opened", () => {
    const root = project({
      "package.json": "{}",
      "src/demos/one-scene/index.tsx": "",
      "src/index.ts": "",
    });

    expect(remotionRootOf(path.join(root, "src/demos/one-scene"))).toBe(root);
  });

  it("finds the entry point from a folder deep inside the project", async () => {
    const root = project({
      "package.json": "{}",
      "src/demos/one-scene/index.tsx": "",
      "src/index.ts": "",
    });

    const opened = path.join(root, "src/demos/one-scene");
    const entry = await Effect.runPromise(entryPointOf(remotionRootOf(opened)));

    expect(entry).toBe(path.join(root, "src/index.ts"));
  });
});
