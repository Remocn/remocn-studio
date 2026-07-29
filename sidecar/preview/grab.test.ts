// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { withoutWebFonts } from "./grab";

const FONT_HOST = "fonts.googleapis.com";

function vendored(): string {
  const require = createRequire(import.meta.url);
  return readFileSync(require.resolve("grab/dist/index.global.js"), "utf8");
}

describe("withoutWebFonts", () => {
  it("takes the at-rule out as the bundle spells it", () => {
    const source = String.raw`i.textContent=\`@import url(\"https://fonts.googleapis.com/css2?family=Geist:wght@500&display=swap\");\n\``;

    expect(withoutWebFonts(source).source).not.toContain(FONT_HOST);
  });

  it("counts what it took, so a silent miss is visible in the log", () => {
    const source = String.raw`a@import url(\"https://fonts.googleapis.com/css2?family=Geist\");\nb`;

    expect(withoutWebFonts(source).removed).toBe(1);
  });

  it("leaves a bundle that asks for no web font alone", () => {
    expect(withoutWebFonts("const a = 1;")).toEqual({
      removed: 0,
      source: "const a = 1;",
    });
  });

  it("leaves a relative import alone, since it costs no third party", () => {
    const source = '@import url("./styles.css");';

    expect(withoutWebFonts(source).source).toBe(source);
  });

  it("leaves the version of grab we ship asking for nothing outside", () => {
    const stripped = withoutWebFonts(vendored());

    expect(stripped.removed).toBeGreaterThan(0);
    expect(stripped.source).not.toContain(FONT_HOST);
  });
});
