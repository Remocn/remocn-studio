import { describe, expect, it } from "bun:test";
import type { ExportEvent } from "@/shared/ipc";
import {
  exportBrief,
  exportLabel,
  exportPercent,
  exportStatus,
  fileSize,
  folderLabel,
  targetPath,
} from "./export";

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
      "Downloading the renderer’s browser — 40%"
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
    expect(exportStatus(progress({ total: 0 }))).toBe("Measuring the video…");
  });
});

describe("exportBrief", () => {
  it("says it is starting, with no number, before the first event", () => {
    expect(exportBrief(null)).toEqual({ label: "Starting…", percent: null });
  });

  it("names the browser download and its percentage", () => {
    expect(exportBrief({ percent: 40, type: "browser" })).toEqual({
      label: "Downloading · 40%",
      percent: 40,
    });
  });

  it("measures with no number rather than dividing by zero", () => {
    expect(exportBrief(progress({ total: 0 }))).toEqual({
      label: "Measuring…",
      percent: null,
    });
  });

  it("names the render stage next to its percentage", () => {
    expect(exportBrief(progress({ percent: 21, rendered: 64 }))).toEqual({
      label: "Rendering · 21%",
      percent: 21,
    });
  });

  it("moves on to encoding once every frame is rendered", () => {
    expect(
      exportBrief(progress({ encoded: 280, percent: 95, rendered: 300 }))
    ).toEqual({ label: "Encoding · 95%", percent: 95 });
  });

  it("combines with no number rather than a stalled 100%", () => {
    expect(
      exportBrief(
        progress({ encoded: 300, percent: 100, rendered: 300, stage: "muxing" })
      )
    ).toEqual({ label: "Combining…", percent: null });
  });

  it("finishes with no number when the stage is not muxing", () => {
    expect(
      exportBrief(progress({ encoded: 300, percent: 100, rendered: 300 }))
    ).toEqual({ label: "Finishing…", percent: null });
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
  it("leaves the size out when the render never reported one", () => {
    expect(
      exportLabel(
        { bytes: 48_000, height: 0, path: "/tmp/Main.mp4", width: 0 },
        null
      )
    ).toBe("/tmp/Main.mp4 · 47 KB");
  });

  it("shows the path relative to the project it was rendered in", () => {
    expect(
      exportLabel(
        {
          bytes: 4_404_019,
          height: 1080,
          path: "/Users/me/scenes/out/Main.mp4",
          width: 1920,
        },
        "/Users/me/scenes"
      )
    ).toBe("out/Main.mp4 · 1920×1080 · 4.2 MB");
  });

  it("falls back to the whole path when it is somewhere else", () => {
    expect(
      exportLabel(
        {
          bytes: 48_000,
          height: 1080,
          path: "/tmp/other/out/Main.mp4",
          width: 1920,
        },
        "/Users/me"
      )
    ).toBe("/tmp/other/out/Main.mp4 · 1920×1080 · 47 KB");
  });

  it("shows the whole path when there is no project to compare against", () => {
    expect(
      exportLabel(
        {
          bytes: 48_000,
          height: 1080,
          path: "/Users/me/scenes/out/Main.mp4",
          width: 1920,
        },
        null
      )
    ).toBe("/Users/me/scenes/out/Main.mp4 · 1920×1080 · 47 KB");
  });
});

describe("where an export goes", () => {
  const ROOT = "/Users/me/scenes";

  it("defaults to the project's own out/ folder", () => {
    expect(folderLabel(null, ROOT)).toBe("out");
    expect(targetPath({ fileName: "Main.mp4", folder: null, root: ROOT })).toBe(
      "/Users/me/scenes/out/Main.mp4"
    );
  });

  it("stays relative while the folder is inside the project", () => {
    expect(folderLabel("/Users/me/scenes/renders", ROOT)).toBe("renders");
    expect(folderLabel("/Users/me/scenes", ROOT)).toBe("the project folder");
  });

  it("shortens a folder somewhere else to a path a person can read", () => {
    expect(folderLabel("/Users/me/Desktop", ROOT)).toBe("~/Desktop");
    expect(folderLabel("/home/me/Videos", ROOT)).toBe("~/Videos");
    expect(folderLabel("/Volumes/Work/out", ROOT)).toBe("/Volumes/Work/out");
  });

  it("hands the host a relative path when it does not know the project folder", () => {
    expect(targetPath({ fileName: "Main.mp4", folder: null, root: null })).toBe(
      "out/Main.mp4"
    );
  });

  it("uses the folder that was chosen, wherever it is", () => {
    expect(
      targetPath({
        fileName: "Main.webm",
        folder: "/Volumes/Work",
        root: ROOT,
      })
    ).toBe("/Volumes/Work/Main.webm");
  });
});
