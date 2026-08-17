import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileIcon } from "@/components/studio/file-icon";
import { FILE_ICON_KINDS } from "@/lib/studio/file-icons";

function glyphFor(path: string) {
  const { container } = render(<FileIcon path={path} />);
  return container.querySelector("svg");
}

describe("FileIcon", () => {
  it("gives a known kind its brand mark", () => {
    expect(glyphFor("src/scenes/Intro.tsx")?.textContent).toBe("React");
    expect(glyphFor("lib/ease.ts")?.textContent).toBe("TypeScript");
    expect(glyphFor("package.json")?.textContent).toBe("JSON");
    expect(glyphFor("README.md")?.textContent).toBe("Markdown");
  });

  it("falls back to a plain lucide glyph where no brand fits", () => {
    for (const path of ["public/intro.mp4", "fonts/Inter.woff2", "LICENSE"]) {
      const glyph = glyphFor(path);
      expect(glyph?.textContent).toBe("");
      expect(glyph?.getAttribute("stroke")).toBe("currentColor");
    }
  });

  it("draws every kind the mapping can return", () => {
    for (const kind of FILE_ICON_KINDS) {
      expect(GLYPH_PATHS.get(kind)).toBeDefined();
      expect(glyphFor(GLYPH_PATHS.get(kind) ?? "")).not.toBeNull();
    }
  });

  it("hides the glyph from a screen reader, which reads the row instead", () => {
    expect(glyphFor("src/Root.tsx")?.getAttribute("aria-hidden")).toBe("true");
  });
});

const GLYPH_PATHS = new Map([
  ["archive", "bundle.zip"],
  ["audio", "theme.mp3"],
  ["css", "globals.css"],
  ["docker", "Dockerfile"],
  ["file", "LICENSE"],
  ["font", "Inter.woff2"],
  ["git", ".gitignore"],
  ["html", "index.html"],
  ["image", "logo.png"],
  ["javascript", "next.config.mjs"],
  ["json", "package.json"],
  ["markdown", "README.md"],
  ["python", "tool.py"],
  ["react", "Intro.tsx"],
  ["rust", "main.rs"],
  ["sass", "theme.scss"],
  ["shell", "build.sh"],
  ["svg", "logo.svg"],
  ["text", "notes.txt"],
  ["toml", "Cargo.toml"],
  ["typescript", "ease.ts"],
  ["video", "intro.mp4"],
  ["yaml", "publish.yml"],
]);
