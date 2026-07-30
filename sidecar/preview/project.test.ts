// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import {
  agreedVersionIn,
  configFile,
  entryPointOf,
  packageVersionOf,
  remotionRootOf,
} from "./project";

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

function installed(versions: Record<string, string | null>): string {
  const files: Record<string, string> = { "package.json": "{}" };

  for (const [name, version] of Object.entries(versions)) {
    if (version !== null) {
      files[`node_modules/${name}/package.json`] = JSON.stringify({
        name,
        version,
      });
    }
  }

  return project(files);
}

const ALL_AGREEING = {
  "@remotion/bundler": "4.0.481",
  "@remotion/renderer": "4.0.481",
  remotion: "4.0.481",
};

describe("packageVersionOf", () => {
  it("reads a version out of the project's own node_modules", async () => {
    const root = installed(ALL_AGREEING);

    const version = await Effect.runPromise(packageVersionOf(root, "remotion"));

    expect(version).toBe("4.0.481");
  });

  it("says which package is not installed", async () => {
    const exit = await Effect.runPromiseExit(
      packageVersionOf(installed({ remotion: "4.0.481" }), "@remotion/renderer")
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("@remotion/renderer is not installed");
  });
});

describe("agreedVersionIn", () => {
  it("agrees when the render packages match remotion", async () => {
    const version = await Effect.runPromise(
      agreedVersionIn(installed(ALL_AGREEING))
    );

    expect(version).toBe("4.0.481");
  });

  it("refuses a renderer that is a different version from remotion", async () => {
    const root = installed({
      ...ALL_AGREEING,
      "@remotion/renderer": "4.0.100",
    });

    const exit = await Effect.runPromiseExit(agreedVersionIn(root));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("@remotion/renderer is 4.0.100");
    expect(String(exit)).toContain("remotion is 4.0.481");
  });

  it("names every package that drifted, not just the first", async () => {
    const root = installed({
      "@remotion/bundler": "4.0.200",
      "@remotion/renderer": "4.0.100",
      remotion: "4.0.481",
    });

    const exit = await Effect.runPromiseExit(agreedVersionIn(root));

    expect(String(exit)).toContain("@remotion/bundler is 4.0.200");
    expect(String(exit)).toContain("@remotion/renderer is 4.0.100");
  });

  it("refuses a project with no renderer installed at all", async () => {
    const root = installed({
      "@remotion/bundler": "4.0.481",
      "@remotion/renderer": null,
      remotion: "4.0.481",
    });

    const exit = await Effect.runPromiseExit(agreedVersionIn(root));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("@remotion/renderer is not installed");
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
