import { describe, expect, it } from "bun:test";
import {
  advance,
  checkFailure,
  type Download,
  downloadedLabel,
  downloadedShare,
  NO_BUILD_HERE,
  NOTHING_DOWNLOADED,
} from "./updates";

const started = (contentLength?: number) =>
  ({ data: { contentLength }, event: "Started" }) as const;

const progress = (chunkLength: number) =>
  ({ data: { chunkLength }, event: "Progress" }) as const;

const finished = { event: "Finished" } as const;

describe("advance", () => {
  it("takes the total from the first event", () => {
    expect(advance(NOTHING_DOWNLOADED, started(1000))).toEqual({
      received: 0,
      total: 1000,
    });
  });

  it("accumulates chunks", () => {
    const download = [progress(400), progress(600)].reduce(
      advance,
      advance(NOTHING_DOWNLOADED, started(2000))
    );

    expect(download).toEqual({ received: 1000, total: 2000 });
  });

  it("restarts the count when a second download begins", () => {
    const download = advance({ received: 900, total: 1000 }, started(4000));

    expect(download).toEqual({ received: 0, total: 4000 });
  });

  it("keeps the total unknown when the response has no length", () => {
    const download = advance(
      advance(NOTHING_DOWNLOADED, started()),
      progress(512)
    );

    expect(download).toEqual({ received: 512, total: null });
  });

  it("settles on the total when finishing", () => {
    const download = advance({ received: 900, total: 1000 }, finished);

    expect(download).toEqual({ received: 1000, total: 1000 });
  });

  it("leaves an unmeasured download alone when finishing", () => {
    const download: Download = { received: 900, total: null };

    expect(advance(download, finished)).toBe(download);
  });
});

describe("downloadedShare", () => {
  it("is null while the total is unknown", () => {
    expect(downloadedShare({ received: 512, total: null })).toBeNull();
  });

  it("is null when the total is zero", () => {
    expect(downloadedShare({ received: 0, total: 0 })).toBeNull();
  });

  it("rounds to whole percents", () => {
    expect(downloadedShare({ received: 333, total: 1000 })).toBe(33);
  });

  it("never exceeds a hundred", () => {
    expect(downloadedShare({ received: 1200, total: 1000 })).toBe(100);
  });
});

describe("downloadedLabel", () => {
  it("reads as a percentage when the total is known", () => {
    expect(downloadedLabel({ received: 500, total: 1000 })).toBe(
      "Downloading — 50%"
    );
  });

  it("falls back to megabytes when it is not", () => {
    expect(downloadedLabel({ received: 2_500_000, total: null })).toBe(
      "Downloading — 2.5 MB"
    );
  });
});

// tauri-plugin-updater's own words, from its error.rs: the first when a target
// was named, the second when it fell back through `{os}-{arch}-{installer}`
// and `{os}-{arch}`.
const TARGET_MISSING =
  "the platform `linux-x86_64` was not found in the response `platforms` object";
const TARGETS_MISSING =
  'None of the fallback platforms `["linux-x86_64-deb", "linux-x86_64"]` were found in the response `platforms` object';

describe("checkFailure", () => {
  it("says a release without this system's build in a sentence", () => {
    expect(checkFailure(TARGETS_MISSING).message).toBe(NO_BUILD_HERE);
    expect(checkFailure(new Error(TARGET_MISSING)).message).toBe(NO_BUILD_HERE);
  });

  it("keeps every other failure's own words", () => {
    expect(checkFailure("error sending request for url").message).toBe(
      "error sending request for url"
    );
  });
});
