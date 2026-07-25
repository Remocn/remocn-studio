// @vitest-environment node

import { describe, expect, it } from "vitest";
import { previewPage } from "./html";

const page = (title = "demo") =>
  previewPage({ publicPath: "/", staticBase: "/static-abc123", title });

describe("previewPage", () => {
  it("renders the element Remotion mounts into", () => {
    expect(page()).toContain('id="__remotion-studio-container"');
  });

  it("publishes the static base staticFile() reads", () => {
    expect(page()).toContain('window.remotion_staticBase = "/static-abc123";');
  });

  it("declares itself as not the studio so env variables are read", () => {
    expect(page()).toContain("window.remotion_isStudio = false;");
    expect(page()).toContain('window.remotion_envVariables = "{}";');
  });

  it("loads the bundle the compiler writes", () => {
    expect(page()).toContain('<script src="/bundle.js"></script>');
  });

  it("escapes the title, which is a folder name off disk", () => {
    expect(page("<script>x</script>")).toContain(
      "<title>&lt;script&gt;x&lt;/script&gt;</title>"
    );
  });
});
