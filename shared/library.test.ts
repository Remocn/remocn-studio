import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  type Asset,
  AssetManifest,
  assetTypeFor,
  assetTypeOf,
  assetTypeOfStock,
  needsProxy,
  playableFileOf,
  promptAssetOf,
  proxyableFileOf,
  slugOf,
} from "@/shared/library";

const ASSET: Asset = {
  category: null,
  clip: null,
  createdAt: 7,
  dependencies: ["three"],
  description: "A neon title",
  duration: null,
  files: ["NeonTitle.tsx"],
  name: "Neon Title",
  path: "/library/assets/neon-title",
  preview: "/library/assets/neon-title/preview.png",
  proxied: false,
  role: null,
  slug: "neon-title",
  source: null,
  type: "component",
};

describe("slugOf", () => {
  it("folds a name down to a safe folder name", () => {
    expect(slugOf("Neon Title")).toBe("neon-title");
    expect(slugOf("Logo (2024).png")).toBe("logo-2024-.png");
  });

  it("trims the punctuation off the edges", () => {
    expect(slugOf("--Intro--")).toBe("intro");
  });

  it("falls back rather than answering with nothing", () => {
    expect(slugOf("...")).toBe("asset");
    expect(slugOf("")).toBe("asset");
  });
});

describe("assetTypeOf", () => {
  it("reads the kind out of the extension", () => {
    expect(assetTypeOf("logo.png")).toBe("img");
    expect(assetTypeOf("clip.MP4")).toBe("video");
    expect(assetTypeOf("theme.wav")).toBe("audio");
    expect(assetTypeOf("Scene.tsx")).toBe("component");
  });

  it("answers null for an extension it does not know", () => {
    expect(assetTypeOf("notes.md")).toBeNull();
    expect(assetTypeOf("Makefile")).toBeNull();
  });
});

describe("assetTypeFor", () => {
  it("calls a set holding any code a component", () => {
    expect(assetTypeFor(["Scene.tsx", "logo.png"])).toBe("component");
  });

  it("takes the kind of the media when there is no code", () => {
    expect(assetTypeFor(["theme.mp3"])).toBe("audio");
  });

  it("treats an unreadable set as a component rather than guessing media", () => {
    expect(assetTypeFor(["notes.md"])).toBe("component");
    expect(assetTypeFor([])).toBe("component");
  });
});

describe("playableFileOf", () => {
  it("points at the video itself, for a card with no still to show", () => {
    expect(
      playableFileOf({
        ...ASSET,
        files: ["intro.mp4"],
        path: "/library/assets/intro",
        type: "video",
      })
    ).toBe("/library/assets/intro/intro.mp4");
  });

  it("has nothing to fall back to for anything that is not video", () => {
    expect(playableFileOf(ASSET)).toBeNull();
    expect(playableFileOf({ ...ASSET, type: "img" })).toBeNull();
    expect(playableFileOf({ ...ASSET, type: "audio" })).toBeNull();
  });

  it("is null for a video whose manifest lists no file", () => {
    expect(playableFileOf({ ...ASSET, files: [], type: "video" })).toBeNull();
  });
});

describe("needsProxy", () => {
  it("re-encodes anything taller than the target", () => {
    expect(needsProxy("video", 2160)).toBe(true);
    expect(needsProxy("video", 1081)).toBe(true);
  });

  // A 1080p clip already seeks in 6ms, which is a fifth of a frame at 30fps.
  // Re-encoding it would cost minutes and buy nothing.
  it("leaves a clip already at the target alone", () => {
    expect(needsProxy("video", 1080)).toBe(false);
    expect(needsProxy("video", 720)).toBe(false);
  });

  it("is only ever about video", () => {
    expect(needsProxy("audio", 2160)).toBe(false);
    expect(needsProxy("img", 2160)).toBe(false);
    expect(needsProxy("component", 2160)).toBe(false);
  });
});

describe("proxyableFileOf", () => {
  const clip: Asset = { ...ASSET, files: ["intro.mp4"], type: "video" };

  it("is the one file a proxy would stand in for", () => {
    expect(proxyableFileOf(clip)).toBe("/library/assets/neon-title/intro.mp4");
  });

  it("is null for anything that is not a video", () => {
    expect(proxyableFileOf(ASSET)).toBeNull();
    expect(proxyableFileOf({ ...clip, type: "audio" })).toBeNull();
  });

  it("is null when there is no single file to stand in for", () => {
    expect(proxyableFileOf({ ...clip, files: [] })).toBeNull();
    expect(proxyableFileOf({ ...clip, files: ["a.mp4", "b.mp4"] })).toBeNull();
  });
});

describe("promptAssetOf", () => {
  it("keeps only what a reference needs to render and resolve", () => {
    expect(promptAssetOf(ASSET)).toEqual({
      name: "Neon Title",
      preview: "/library/assets/neon-title/preview.png",
      slug: "neon-title",
      type: "component",
    });
  });
});

describe("assetTypeOfStock", () => {
  it("files a photo as an image and a clip as a video", () => {
    expect(assetTypeOfStock("photo")).toBe("img");
    expect(assetTypeOfStock("video")).toBe("video");
  });
});

describe("AssetManifest", () => {
  it("reads a manifest written before sources existed", () => {
    const decoded = Schema.decodeUnknownSync(AssetManifest)({
      files: ["a.png"],
      name: "A picture",
      type: "img",
    });

    expect(decoded.source).toBeNull();
  });
});
