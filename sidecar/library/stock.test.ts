// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LIBRARY_DIR_ENV,
  PEXELS_KEY_ENV,
  type StockProgress,
} from "@/shared/ipc";
import type { StockItem } from "@/shared/library";
import {
  attributionOf,
  downloadNameOf,
  NO_KEY,
  PER_PAGE,
  pageOf,
  photoItemOf,
  saveStock,
  searchStock,
  setStockKey,
  stockConfigured,
  stockKey,
  videoItemOf,
} from "@/sidecar/library/stock";
import { findAsset } from "@/sidecar/library/store";

let library = "";

beforeEach(() => {
  library = mkdtempSync(join(tmpdir(), "stock-test-"));
  process.env[LIBRARY_DIR_ENV] = library;
  delete process.env[PEXELS_KEY_ENV];
});

afterEach(() => {
  delete process.env[LIBRARY_DIR_ENV];
  delete process.env[PEXELS_KEY_ENV];
  rmSync(library, { force: true, recursive: true });
});

const PHOTO = {
  alt: "Brown rocks during golden hour",
  avg_color: "#978E82",
  height: 6720,
  id: 2_014_422,
  liked: false,
  photographer: "Joey Farina",
  photographer_id: 680_589,
  photographer_url: "https://www.pexels.com/@joey",
  src: {
    landscape:
      "https://images.pexels.com/photos/2014422/a.jpeg?fit=crop&h=627&w=1200",
    large: "https://images.pexels.com/photos/2014422/a.jpeg?h=650&w=940",
    large2x: "https://images.pexels.com/photos/2014422/a.jpeg?h=1300&w=1880",
    medium: "https://images.pexels.com/photos/2014422/a.jpeg?h=350",
    original: "https://images.pexels.com/photos/2014422/a.jpeg",
    portrait:
      "https://images.pexels.com/photos/2014422/a.jpeg?fit=crop&h=1200&w=800",
    small: "https://images.pexels.com/photos/2014422/a.jpeg?h=130",
    tiny: "https://images.pexels.com/photos/2014422/a.jpeg?fit=crop&h=200&w=280",
  },
  url: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
  width: 3024,
};

const VIDEO = {
  duration: 121,
  height: 1080,
  id: 1_448_735,
  image:
    "https://images.pexels.com/videos/1448735/free-video-1448735.jpg?fit=crop&h=630&w=1200",
  url: "https://www.pexels.com/video/video-of-a-rocky-shore-1448735/",
  user: {
    id: 574_687,
    name: "Ruvim Miksanskiy",
    url: "https://www.pexels.com/@digitech",
  },
  video_files: [
    {
      file_type: "video/mp4",
      fps: 23.98,
      height: 540,
      id: 58_649,
      link: "https://player.vimeo.com/external/291648067.sd.mp4?a=1",
      quality: "sd",
      width: 960,
    },
    {
      file_type: "video/mp4",
      fps: 23.98,
      height: 1080,
      id: 58_650,
      link: "https://player.vimeo.com/external/291648067.hd.mp4?a=1",
      quality: "hd",
      width: 1920,
    },
    {
      file_type: "application/x-mpegURL",
      fps: null,
      height: null,
      id: 58_651,
      link: "https://player.vimeo.com/external/291648067.m3u8?a=1",
      quality: "hls",
      width: null,
    },
  ],
  width: 1920,
};

describe("photoItemOf", () => {
  it("maps a Pexels photo onto the neutral item", () => {
    expect(photoItemOf(PHOTO)).toEqual({
      author: "Joey Farina",
      authorUrl: "https://www.pexels.com/@joey",
      download: "https://images.pexels.com/photos/2014422/a.jpeg",
      duration: null,
      height: 6720,
      id: "2014422",
      kind: "photo",
      name: "Brown rocks during golden hour",
      thumbnail: "https://images.pexels.com/photos/2014422/a.jpeg?h=350",
      url: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
      width: 3024,
    });
  });

  it("cuts a sentence-length alt at a word boundary", () => {
    const item = photoItemOf({
      ...PHOTO,
      alt: "Sunset light casts a warm glow on rocks by a calm lake with mirror-like reflections, creating a serene atmosphere.",
    });

    expect(item?.name).toBe(
      "Sunset light casts a warm glow on rocks by a calm lake with"
    );
  });

  it("names an untitled photo after its photographer", () => {
    const item = photoItemOf({ ...PHOTO, alt: null });
    expect(item?.name).toBe("Photo by Joey Farina");
  });

  it("tolerates absent optional fields", () => {
    const item = photoItemOf({
      height: 10,
      id: 1,
      src: { original: "https://images.pexels.com/photos/1/a.jpeg" },
      width: 10,
    });

    expect(item).toMatchObject({
      author: "",
      name: "Photo by Pexels",
      thumbnail: "https://images.pexels.com/photos/1/a.jpeg",
    });
  });

  it("refuses a shape with no original", () => {
    expect(photoItemOf({ height: 10, id: 1, src: {}, width: 10 })).toBeNull();
  });
});

describe("videoItemOf", () => {
  it("maps a Pexels video, naming it from its page and downloading the largest mp4", () => {
    expect(videoItemOf(VIDEO)).toEqual({
      author: "Ruvim Miksanskiy",
      authorUrl: "https://www.pexels.com/@digitech",
      download: "https://player.vimeo.com/external/291648067.hd.mp4?a=1",
      duration: 121,
      height: 1080,
      id: "1448735",
      kind: "video",
      name: "Video of a rocky shore",
      thumbnail:
        "https://images.pexels.com/videos/1448735/free-video-1448735.jpg?fit=crop&h=630&w=1200",
      url: "https://www.pexels.com/video/video-of-a-rocky-shore-1448735/",
      width: 1920,
    });
  });

  it("refuses a video with no files", () => {
    expect(videoItemOf({ ...VIDEO, video_files: [] })).toBeNull();
  });

  it("names an unlinked video after its author", () => {
    const item = videoItemOf({ ...VIDEO, url: null });
    expect(item?.name).toBe("Video by Ruvim Miksanskiy");
  });
});

describe("pageOf", () => {
  it("counts the pages from the total", () => {
    expect(pageOf("photo", 1, PER_PAGE * 2 + 1, [PHOTO]).nextPage).toBe(2);
    expect(pageOf("photo", 3, PER_PAGE * 2 + 1, [PHOTO]).nextPage).toBeNull();
  });

  it("drops entries that do not decode instead of failing the page", () => {
    const page = pageOf("photo", 1, 2, [PHOTO, { nonsense: true }]);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });
});

describe("downloadNameOf", () => {
  function item(shape: Partial<StockItem>): StockItem {
    const base = photoItemOf(PHOTO);
    if (base === null) {
      throw new Error("the fixture stopped decoding");
    }
    return { ...base, ...shape };
  }

  it("keeps the extension the URL carries", () => {
    expect(downloadNameOf(item({}))).toBe(
      "brown-rocks-during-golden-hour.jpeg"
    );
  });

  it("falls back to the kind when the URL hides it", () => {
    expect(
      downloadNameOf(
        item({ download: "https://cdn.example.com/external/291648067" })
      )
    ).toBe("brown-rocks-during-golden-hour.jpg");
    expect(
      downloadNameOf(
        item({
          download: "https://cdn.example.com/external/291648067",
          kind: "video",
          name: "Rocky shore",
        })
      )
    ).toBe("rocky-shore.mp4");
  });
});

describe("attributionOf", () => {
  it("credits the author", () => {
    const item = photoItemOf(PHOTO);
    expect(item === null ? "" : attributionOf(item)).toBe(
      "Photo by Joey Farina on Pexels"
    );
  });
});

describe("the key", () => {
  it("starts unconfigured, remembers a key, and forgets it", async () => {
    expect(await Effect.runPromise(stockConfigured())).toBe(false);

    expect(await Effect.runPromise(setStockKey("abc"))).toBe(true);
    expect(await Effect.runPromise(stockKey())).toBe("abc");

    expect(await Effect.runPromise(setStockKey(null))).toBe(false);
    expect(await Effect.runPromise(stockKey())).toBeNull();
  });

  it("falls back to the environment", async () => {
    process.env[PEXELS_KEY_ENV] = "from-env";
    expect(await Effect.runPromise(stockKey())).toBe("from-env");

    await Effect.runPromise(setStockKey("stored"));
    expect(await Effect.runPromise(stockKey())).toBe("stored");
  });
});

function answering(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): typeof fetch {
  return (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", ...headers },
        status,
      })
    )) as typeof fetch;
}

describe("searchStock", () => {
  const QUERY = { kind: "photo", page: 1, query: "rocks" } as const;

  it("asks for a key before it asks Pexels", async () => {
    const exit = await Effect.runPromiseExit(searchStock(QUERY));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain(NO_KEY);
  });

  it("maps a photo page", async () => {
    await Effect.runPromise(setStockKey("abc"));

    const page = await Effect.runPromise(
      searchStock(QUERY, answering({ photos: [PHOTO], total_results: 61 }))
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.kind).toBe("photo");
    expect(page.nextPage).toBe(2);
    expect(page.total).toBe(61);
  });

  it("maps a video page", async () => {
    await Effect.runPromise(setStockKey("abc"));

    const page = await Effect.runPromise(
      searchStock(
        { kind: "video", page: 1, query: "shore" },
        answering({ total_results: 1, videos: [VIDEO] })
      )
    );

    expect(page.items[0]?.kind).toBe("video");
    expect(page.nextPage).toBeNull();
  });

  it("blames the key on a 401", async () => {
    await Effect.runPromise(setStockKey("abc"));

    const exit = await Effect.runPromiseExit(
      searchStock(QUERY, answering({}, 401))
    );
    expect(String(exit)).toContain("refused the API key");
  });
});

describe("saveStock", () => {
  it("downloads into the library with the source remembered", async () => {
    const item = photoItemOf(PHOTO);
    if (item === null) {
      throw new Error("the fixture stopped decoding");
    }

    const bytes = new TextEncoder().encode("picture bytes");
    const fetcher = (() =>
      Promise.resolve(
        new Response(bytes, {
          headers: { "content-length": String(bytes.byteLength) },
          status: 200,
        })
      )) as typeof fetch;

    const reports: StockProgress[] = [];
    const saved = await Effect.runPromise(
      saveStock(item, (report) => reports.push(report), fetcher)
    );

    expect(saved.name).toBe("Brown rocks during golden hour");
    expect(saved.type).toBe("img");
    expect(saved.files).toEqual(["brown-rocks-during-golden-hour.jpeg"]);
    expect(saved.source).toEqual({
      author: "Joey Farina",
      authorUrl: "https://www.pexels.com/@joey",
      id: "2014422",
      provider: "pexels",
      url: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
    });
    expect(saved.description).toBe("Photo by Joey Farina on Pexels");

    expect(reports.at(-1)).toEqual({
      received: bytes.byteLength,
      total: bytes.byteLength,
    });

    const listed = await Effect.runPromise(findAsset(saved.slug));
    expect(listed?.source?.provider).toBe("pexels");
  });

  it("reports a download that answered badly", async () => {
    const item = photoItemOf(PHOTO);
    if (item === null) {
      throw new Error("the fixture stopped decoding");
    }

    const fetcher = (() =>
      Promise.resolve(new Response(null, { status: 404 }))) as typeof fetch;

    const exit = await Effect.runPromiseExit(
      saveStock(item, () => undefined, fetcher)
    );
    expect(String(exit)).toContain("404");
  });
});
