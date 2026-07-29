// @vitest-environment node

import { describe, expect, it } from "vitest";
import { previewPage } from "./html";

const ROOT = "/Users/me/projects/my-video";

const page = (
  title = "demo",
  preferred: string | null = null,
  hasGrab = true
) =>
  previewPage({
    hasGrab,
    preferred,
    publicPath: "/",
    root: ROOT,
    staticBase: "/static-abc123",
    title,
  });

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

  it("carries no preferred composition when the project root was opened", () => {
    expect(page()).toContain("window.remocn_preferred = null;");
  });

  it("names the composition the opened folder asks for", () => {
    expect(page("demo", "introducing-opus-5")).toContain(
      'window.remocn_preferred = "introducing-opus-5";'
    );
  });

  it("publishes the Remotion root the entry resolves source paths against", () => {
    expect(page()).toContain(`window.remocn_root = "${ROOT}";`);
  });

  it("escapes the title, which is a folder name off disk", () => {
    expect(page("<script>x</script>")).toContain(
      "<title>&lt;script&gt;x&lt;/script&gt;</title>"
    );
  });

  it("stops grab initialising itself before the app has said how", () => {
    expect(page()).toContain("window.__REACT_GRAB_DISABLED__ = true;");
  });

  it("loads grab before the bundle, so the hook beats React to the page", () => {
    const html = page();

    expect(html.indexOf("/__remocn/grab.js")).toBeLessThan(
      html.indexOf("/bundle.js")
    );
  });

  it("leaves grab out when the app could not resolve its script", () => {
    expect(page("demo", null, false)).not.toContain("/__remocn/grab.js");
  });
});
