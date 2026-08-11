// @vitest-environment node

import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Index, keyOf, libraryIndex, proxies } from "./proxies";

const BYTES = Buffer.from("the original, standing in for fifteen megabytes");
const HASH = createHash("sha256").update(BYTES).digest("hex");

let root = "";

function file(name: string, body: Buffer | string): string {
  const path = join(root, name);
  writeFileSync(path, body);
  return path;
}

function asset(slug: string, manifest: Record<string, unknown>) {
  const dir = join(root, "assets", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
  return dir;
}

function fixed(entries: Record<string, string>): Index {
  return { at: (hash) => entries[hash] ?? null };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "remocn-proxies-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("proxies", () => {
  it("answers with the proxy standing in for the file's content", () => {
    const original = file("clip.mp4", BYTES);
    const held = proxies(fixed({ [HASH]: "/library/assets/clip/proxy.mp4" }));

    expect(held.of(original, statSync(original))).toBe(
      "/library/assets/clip/proxy.mp4"
    );
  });

  it("matches a copy of the same bytes at another path", () => {
    const one = file("clip.mp4", BYTES);
    const other = file("copied.mp4", BYTES);
    const held = proxies(fixed({ [HASH]: "/proxy.mp4" }));

    expect(held.of(one, statSync(one))).toBe("/proxy.mp4");
    expect(held.of(other, statSync(other))).toBe("/proxy.mp4");
  });

  it("leaves a file nobody has a proxy for alone", () => {
    const original = file("clip.mp4", BYTES);

    expect(proxies(fixed({})).of(original, statSync(original))).toBeNull();
  });

  // The hash is memoised, the lookup is not: a conversion takes minutes and
  // lands while the preview is already streaming the original.
  it("picks up a proxy that appears after the first miss", () => {
    const original = file("clip.mp4", BYTES);
    const entries: Record<string, string> = {};
    const held = proxies(fixed(entries));

    expect(held.of(original, statSync(original))).toBeNull();

    entries[HASH] = "/proxy.mp4";

    expect(held.of(original, statSync(original))).toBe("/proxy.mp4");
  });

  it("hashes a file again once it has been rewritten", () => {
    const original = file("clip.mp4", BYTES);
    const other = createHash("sha256").update("replaced").digest("hex");
    const held = proxies(fixed({ [other]: "/other.mp4" }));

    expect(held.of(original, statSync(original))).toBeNull();

    writeFileSync(original, "replaced");

    expect(held.of(original, statSync(original))).toBe("/other.mp4");
  });

  it("says nothing for a path it cannot read", () => {
    const missing = join(root, "gone.mp4");

    expect(
      proxies(fixed({ [HASH]: "/proxy.mp4" })).of(missing, statSync(root))
    ).toBeNull();
  });
});

describe("keyOf", () => {
  it("changes when the file is rewritten", () => {
    const path = file("clip.mp4", BYTES);
    const before = keyOf(path, statSync(path));

    writeFileSync(path, "longer than it was before");

    expect(keyOf(path, statSync(path))).not.toBe(before);
  });
});

describe("libraryIndex", () => {
  it("maps every hash of an asset to its proxy", () => {
    const dir = asset("clip", {
      files: ["clip.mp4"],
      hashes: [HASH],
      name: "Clip",
      proxied: true,
      proxy: "proxy.mp4",
      type: "video",
    });
    writeFileSync(join(dir, "proxy.mp4"), "proxy");

    expect(libraryIndex(root, 0).at(HASH)).toBe(join(dir, "proxy.mp4"));
  });

  it("ignores an asset whose proxy file is not there", () => {
    asset("clip", {
      files: ["clip.mp4"],
      hashes: [HASH],
      name: "Clip",
      proxied: true,
      proxy: "proxy.mp4",
      type: "video",
    });

    expect(libraryIndex(root, 0).at(HASH)).toBeNull();
  });

  it("ignores an asset that was decided against", () => {
    asset("clip", {
      files: ["clip.mp4"],
      hashes: [HASH],
      name: "Clip",
      proxied: true,
      proxy: null,
      type: "video",
    });

    expect(libraryIndex(root, 0).at(HASH)).toBeNull();
  });

  it("survives a library that is not there at all", () => {
    expect(libraryIndex(join(root, "nowhere"), 0).at(HASH)).toBeNull();
  });

  it("sees an asset filed after it first read the folder", () => {
    const index = libraryIndex(root, 0);

    expect(index.at(HASH)).toBeNull();

    const dir = asset("clip", {
      files: ["clip.mp4"],
      hashes: [HASH],
      name: "Clip",
      proxied: true,
      proxy: "proxy.mp4",
      type: "video",
    });
    writeFileSync(join(dir, "proxy.mp4"), "proxy");

    expect(index.at(HASH)).toBe(join(dir, "proxy.mp4"));
  });
});
