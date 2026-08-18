// @vitest-environment node

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFolder, resolveFolder, walkProject } from "./files";

let root = "";

function write(relative: string, body = "") {
  const full = join(root, relative);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "remocn-files-"));

  write("package.json", "{}");
  write("src/Root.tsx");
  write("src/scenes/Intro.tsx");
  write("node_modules/remotion/index.js");
  write("out/Main.mp4");
  write("dist/bundle.js");
  write(".git/HEAD");
  write(".env");
  write("public/logo.png");
});

afterAll(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("walkProject", () => {
  it("lists the project's own files, relative to the root", () => {
    expect(walkProject(root).files).toEqual([
      "package.json",
      "public/logo.png",
      "src/Root.tsx",
      "src/scenes/Intro.tsx",
    ]);
  });

  it("skips node_modules, build output and dot entries", () => {
    const { files } = walkProject(root);

    expect(files.some((file) => file.startsWith("node_modules/"))).toBe(false);
    expect(files.some((file) => file.startsWith("out/"))).toBe(false);
    expect(files.some((file) => file.startsWith("dist/"))).toBe(false);
    expect(files).not.toContain(".env");
  });

  it("reports being cut short at the limit", () => {
    expect(walkProject(root, 2)).toEqual({
      files: ["package.json", "public/logo.png"],
      truncated: true,
    });
    expect(walkProject(root).truncated).toBe(false);
  });

  it("is empty rather than failing for a folder that is not there", () => {
    expect(walkProject(join(root, "nowhere"))).toEqual({
      files: [],
      truncated: false,
    });
  });
});

describe("readFolder", () => {
  it("lists a folder with its directories first", () => {
    const listing = readFolder(root);

    expect(listing.path).toBe(root);
    expect(listing.entries.map((entry) => entry.name)).toEqual([
      ".git",
      "dist",
      "node_modules",
      "out",
      "public",
      "src",
      ".env",
      "package.json",
    ]);
    expect(listing.entries.at(0)?.directory).toBe(true);
    expect(listing.entries.at(-1)?.directory).toBe(false);
  });

  it("reports a symlinked folder as a folder", () => {
    const linked = join(root, "linked");
    symlinkSync(join(root, "src"), linked, "dir");

    const found = readFolder(root).entries.find(
      (entry) => entry.name === "linked"
    );

    expect(found?.directory).toBe(true);
    rmSync(linked, { force: true });
  });

  it("fails for a folder that is not there", () => {
    expect(() => readFolder(join(root, "nowhere"))).toThrow();
  });
});

describe("resolveFolder", () => {
  it("expands a leading tilde against the home folder", () => {
    expect(resolveFolder("~/Movies", "/Users/me")).toBe("/Users/me/Movies");
    expect(resolveFolder("~", "/Users/me")).toBe("/Users/me");
  });

  it("leaves an absolute path alone, normalising it", () => {
    expect(resolveFolder("/Users/me/../me/Movies/")).toBe("/Users/me/Movies");
  });

  it("does not expand a tilde in the middle of a path", () => {
    expect(resolveFolder("/tmp/~me", "/Users/me")).toBe("/tmp/~me");
  });
});
