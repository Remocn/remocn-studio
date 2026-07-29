// @vitest-environment node

import { describe, expect, it } from "vitest";
import { previewPage, renderPage } from "./html";

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
    version: "4.0.481",
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

  it("keeps the render entry quiet, which would otherwise mount the Studio", () => {
    expect(page()).toContain("window.remotion_puppeteerTimeout = 30000;");
  });

  it("carries no node for the renderer to draw into", () => {
    expect(page()).not.toContain('id="video-container"');
  });
});

describe("renderPage", () => {
  const rendered = () =>
    renderPage({
      hasGrab: true,
      preferred: null,
      publicPath: "/",
      root: ROOT,
      staticBase: "/static-abc123",
      title: "demo",
      version: "4.0.481",
    });

  it("renders the element the render entry reads at module scope", () => {
    expect(rendered()).toContain('id="video-container"');
  });

  it("declares the site version the renderer refuses a page without", () => {
    expect(rendered()).toContain('window.siteVersion = "11";');
  });

  it("declares the Remotion version the bundle was built against", () => {
    expect(rendered()).toContain('window.remotion_version = "4.0.481";');
  });

  it("leaves the timeout to the renderer, which sets its own", () => {
    expect(rendered()).not.toContain("remotion_puppeteerTimeout");
  });

  it("declares production, which is what makes Remotion render rather than idle", () => {
    expect(rendered()).toContain(
      'window.process = {"env":{"NODE_ENV":"production"}};'
    );
  });

  it("hands over no env variables, so nothing overwrites that NODE_ENV", () => {
    expect(rendered()).toContain('window.remotion_envVariables = "";');
  });

  it("keeps the player out, since nothing headless should mount one", () => {
    expect(rendered()).not.toContain('id="__remotion-studio-container"');
  });

  it("loads grab nowhere near a render", () => {
    expect(rendered()).not.toContain("/__remocn/grab.js");
  });

  it("loads the bundle relative to itself, so its sourcemap resolves too", () => {
    expect(rendered()).toContain('<script src="bundle.js"></script>');
  });

  it("publishes the static base staticFile() reads", () => {
    expect(rendered()).toContain(
      'window.remotion_staticBase = "/static-abc123";'
    );
  });
});
