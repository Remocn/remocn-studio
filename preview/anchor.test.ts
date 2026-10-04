import { beforeEach, describe, expect, it } from "bun:test";
import { type TestSurface, withSurface } from "@/test/surface";
import { anchorOf, resolveAnchor } from "./anchor";

const escapedQuotesParse = (() => {
  try {
    document.querySelector('[data-design-id="\\""]');
    return true;
  } catch {
    return false;
  }
})();

function canvas(html: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "__remotion-player";
  container.innerHTML = html;
  surface.root.append(container);

  return container;
}

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

describe("anchorOf", () => {
  it("hangs the path off the nearest design id", () => {
    const container = canvas(
      '<section><div data-design-id="claim-line"><span>One</span><span>brief</span></div></section>'
    );
    const word = container.querySelectorAll("span")[1] as Element;

    expect(anchorOf(word, container)).toBe(
      '[data-design-id="claim-line"] > :nth-child(2)'
    );
  });

  it("is the id alone when the node is the carrier", () => {
    const container = canvas('<div data-design-id="headline">Hi</div>');
    const node = container.firstElementChild as Element;

    expect(anchorOf(node, container)).toBe('[data-design-id="headline"]');
  });

  it("counts from the canvas when nothing carries a design id", () => {
    const container = canvas("<div></div><div><p>a</p><p>b</p></div>");
    const second = container.querySelectorAll("p")[1] as Element;

    expect(anchorOf(second, container)).toBe(
      ".__remotion-player > :nth-child(2) > :nth-child(2)"
    );
  });

  it("is the canvas itself when the node is the container", () => {
    const container = canvas("<div></div>");

    expect(anchorOf(container, container)).toBe(".__remotion-player");
  });

  it.skipIf(!escapedQuotesParse)(
    "escapes an id that would not parse as a selector",
    () => {
      const container = canvas(
        '<div data-design-id="claim 2&quot;"><span>x</span></div>'
      );
      const span = container.querySelector("span") as Element;
      const anchor = anchorOf(span, container);

      expect(resolveAnchor(anchor, container)).toBe(span);
    }
  );
});

describe("a round trip through the DOM", () => {
  it("comes back to the node it was taken from, per instance", () => {
    const container = canvas(
      [
        '<div data-design-id="line-1"><span><span>One</span></span></div>',
        '<div data-design-id="line-2"><span><span>Two</span></span></div>',
      ].join("")
    );
    const words = [...container.querySelectorAll("span > span")];

    for (const word of words) {
      expect(resolveAnchor(anchorOf(word, container), container)).toBe(word);
    }

    expect(anchorOf(words[0] as Element, container)).not.toBe(
      anchorOf(words[1] as Element, container)
    );
  });

  it("comes back with no design id anywhere", () => {
    const container = canvas("<div><span>a</span><span>b</span></div>");
    const node = container.querySelectorAll("span")[1] as Element;

    expect(resolveAnchor(anchorOf(node, container), container)).toBe(node);
  });
});

describe("resolveAnchor", () => {
  it("answers nothing for a tree that no longer holds the node", () => {
    const container = canvas("<div></div>");

    expect(
      resolveAnchor(".__remotion-player > :nth-child(4)", container)
    ).toBeNull();
  });

  it("answers nothing for an anchor that is not a selector", () => {
    const container = canvas("<div></div>");

    expect(resolveAnchor("[data-design-id=", container)).toBeNull();
    expect(resolveAnchor("", container)).toBeNull();
  });
});
