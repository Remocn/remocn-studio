import { describe, expect, it } from "vitest";
import type { ExportEvent } from "@/shared/ipc";
import { exportLabel, exportPercent, exportStatus, fileSize } from "./export";

function progress(
  overrides: Partial<Extract<ExportEvent, { type: "progress" }>> = {}
): ExportEvent {
  return {
    encoded: 0,
    percent: 0,
    rendered: 0,
    stage: "encoding",
    total: 300,
    type: "progress",
    ...overrides,
  };
}

describe("exportStatus", () => {
  it("says it is starting before the first event arrives", () => {
    expect(exportStatus(null)).toBe("Starting the render…");
  });

  it("names the browser download for what it is", () => {
    expect(exportStatus({ percent: 40, type: "browser" })).toBe(
      "Downloading the renderer's browser — 40%"
    );
  });

  it("counts frames while they render", () => {
    expect(
      exportStatus(progress({ encoded: 40, percent: 21, rendered: 64 }))
    ).toBe("Rendering — 64/300 frames · 21%");
  });

  it("moves on to encoding once every frame is rendered", () => {
    expect(
      exportStatus(progress({ encoded: 280, percent: 95, rendered: 300 }))
    ).toBe("Encoding — 280/300 frames · 95%");
  });

  it("says what the last step is doing rather than showing a stalled count", () => {
    expect(
      exportStatus(
        progress({ encoded: 300, percent: 100, rendered: 300, stage: "muxing" })
      )
    ).toBe("Combining the audio and the video…");
  });

  it("waits for a frame count rather than dividing by zero", () => {
    expect(exportStatus(progress({ total: 0 }))).toBe(
      "Measuring the composition…"
    );
  });
});

describe("exportPercent", () => {
  it("has nothing to show before the first event", () => {
    expect(exportPercent(null)).toBeNull();
  });

  it("follows the percent the render reported", () => {
    expect(exportPercent(progress({ percent: 42 }))).toBe(42);
  });
});

describe("fileSize", () => {
  it("reads a megabyte-sized file in megabytes", () => {
    expect(fileSize(4_404_019)).toBe("4.2 MB");
  });

  it("reads a small file in kilobytes", () => {
    expect(fileSize(48_000)).toBe("47 KB");
  });

  it("never rounds a file that exists down to nothing", () => {
    expect(fileSize(12)).toBe("1 KB");
  });

  it("has an answer for an empty file", () => {
    expect(fileSize(0)).toBe("0 KB");
  });
});

describe("exportLabel", () => {
  it("shows the path relative to the project it was rendered in", () => {
    expect(
      exportLabel(
        { bytes: 4_404_019, path: "/Users/me/scenes/out/Main.mp4" },
        "/Users/me/scenes"
      )
    ).toBe("out/Main.mp4 · 4.2 MB");
  });

  it("falls back to the whole path when it is somewhere else", () => {
    expect(
      exportLabel(
        { bytes: 48_000, path: "/tmp/other/out/Main.mp4" },
        "/Users/me"
      )
    ).toBe("/tmp/other/out/Main.mp4 · 47 KB");
  });

  it("shows the whole path when there is no project to compare against", () => {
    expect(
      exportLabel(
        { bytes: 48_000, path: "/Users/me/scenes/out/Main.mp4" },
        null
      )
    ).toBe("/Users/me/scenes/out/Main.mp4 · 47 KB");
  });
});
