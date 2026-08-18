import { describe, expect, it } from "vitest";
import { fileIconKind } from "@/lib/studio/file-icons";

describe("fileIconKind", () => {
  it("reads the extension, wherever the file sits", () => {
    expect(fileIconKind("src/scenes/Intro.tsx")).toBe("react");
    expect(fileIconKind("/Users/me/video/lib/ease.ts")).toBe("typescript");
    expect(fileIconKind("app/globals.css")).toBe("css");
    expect(fileIconKind("README.md")).toBe("markdown");
  });

  it("does not care about case", () => {
    expect(fileIconKind("public/LOGO.PNG")).toBe("image");
  });

  it("gives media its own glyph", () => {
    expect(fileIconKind("public/intro.mp4")).toBe("video");
    expect(fileIconKind("public/theme.mp3")).toBe("audio");
    expect(fileIconKind("fonts/Inter.woff2")).toBe("font");
  });

  it("knows a few files by name rather than by extension", () => {
    expect(fileIconKind("Dockerfile")).toBe("docker");
    expect(fileIconKind(".gitignore")).toBe("git");
    expect(fileIconKind("bun.lock")).toBe("shell");
  });

  it("takes the last extension of a dotted name", () => {
    expect(fileIconKind(".eslintrc.json")).toBe("json");
    expect(fileIconKind("intro.final.mov")).toBe("video");
  });

  it("falls back to a blank file for anything it does not know", () => {
    expect(fileIconKind("LICENSE")).toBe("file");
    expect(fileIconKind("src/notes.qqq")).toBe("file");
    expect(fileIconKind(".env")).toBe("file");
    expect(fileIconKind("archive.")).toBe("file");
  });

  it("cannot be walked off the prototype by a file called constructor", () => {
    expect(fileIconKind("constructor")).toBe("file");
    expect(fileIconKind("src/constructor.toString")).toBe("file");
  });
});
