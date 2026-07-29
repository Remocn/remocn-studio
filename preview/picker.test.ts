import { beforeEach, describe, expect, it } from "vitest";
import {
  climb,
  hasBorder,
  isDrawing,
  isInlineWrapper,
  isTransparent,
  paints,
  svgRootOf,
} from "./picker";

function mount(html: string): HTMLElement {
  document.body.innerHTML = `<div id="stage">${html}</div>`;
  const stage = document.getElementById("stage");
  if (stage === null) {
    throw new Error("the stage did not mount");
  }
  return stage;
}

function pick(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) {
    throw new Error(`nothing matched ${selector}`);
  }
  return found;
}

function style(declarations: Record<string, string>): CSSStyleDeclaration {
  return declarations as unknown as CSSStyleDeclaration;
}

describe("isTransparent", () => {
  it("reads the two spellings a browser gives for no colour", () => {
    expect(isTransparent("transparent")).toBe(true);
    expect(isTransparent("rgba(0, 0, 0, 0)")).toBe(true);
  });

  it("reads any colour whose alpha is zero", () => {
    expect(isTransparent("rgba(255, 0, 0, 0)")).toBe(true);
    expect(isTransparent("rgba(12, 34, 56, 0.00)")).toBe(true);
  });

  it("keeps a colour that actually paints", () => {
    expect(isTransparent("rgb(255, 0, 0)")).toBe(false);
    expect(isTransparent("rgba(255, 0, 0, 0.05)")).toBe(false);
  });
});

describe("hasBorder", () => {
  it("sees a border that is drawn", () => {
    expect(
      hasBorder(
        style({
          borderBottomWidth: "0px",
          borderLeftWidth: "0px",
          borderRightWidth: "0px",
          borderTopColor: "rgb(0, 0, 0)",
          borderTopWidth: "1px",
        })
      )
    ).toBe(true);
  });

  it("survives a side whose width is a keyword rather than a length", () => {
    expect(
      hasBorder(
        style({
          borderBottomWidth: "medium",
          borderLeftWidth: "medium",
          borderRightWidth: "medium",
          borderTopColor: "rgb(0, 0, 0)",
          borderTopWidth: "1px",
        })
      )
    ).toBe(true);
  });

  it("sees a border drawn on a side other than the top", () => {
    expect(
      hasBorder(
        style({
          borderBottomColor: "rgb(0, 0, 0)",
          borderBottomWidth: "2px",
          borderTopWidth: "0px",
        })
      )
    ).toBe(true);
  });

  it("ignores a border with no width", () => {
    expect(
      hasBorder(
        style({
          borderBottomWidth: "0px",
          borderLeftWidth: "0px",
          borderRightWidth: "0px",
          borderTopColor: "rgb(0, 0, 0)",
          borderTopWidth: "0px",
        })
      )
    ).toBe(false);
  });

  it("ignores a border that is transparent", () => {
    expect(
      hasBorder(
        style({
          borderBottomWidth: "0px",
          borderLeftWidth: "0px",
          borderRightWidth: "0px",
          borderTopColor: "rgba(0, 0, 0, 0)",
          borderTopWidth: "2px",
        })
      )
    ).toBe(false);
  });
});

describe("isInlineWrapper", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads a word in a text split into words", () => {
    mount(
      `<p><span style="display:inline-block">Change</span><span style="display:inline-block">your</span></p>`
    );

    expect(isInlineWrapper(pick("span"))).toBe(true);
  });

  it("reads a lone word too, which is a whole line of one", () => {
    mount(`<p><span style="display:inline-block">Change</span></p>`);

    expect(isInlineWrapper(pick("span"))).toBe(true);
  });

  it("refuses a block-level element, however short its text", () => {
    mount(`<div style="display:block">Auth</div>`);

    expect(isInlineWrapper(pick("div div, #stage > div"))).toBe(false);
  });

  it("refuses an inline element that paints its own surface", () => {
    mount(
      `<p><span style="display:inline-block;background-color:rgb(240,240,240)">mind</span></p>`
    );

    expect(isInlineWrapper(pick("span"))).toBe(false);
  });

  it("refuses an inline element with a border of its own", () => {
    mount(
      `<p><span style="display:inline-block;border-top-width:1px;border-top-style:solid;border-top-color:rgb(0,0,0)">mind</span></p>`
    );

    expect(isInlineWrapper(pick("span"))).toBe(false);
  });

  it("refuses a replaced element, which is a thing in itself", () => {
    mount(`<p><img alt="logo" style="display:inline-block" src="a.png" /></p>`);

    expect(isInlineWrapper(pick("img"))).toBe(false);
  });
});

describe("climb", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("takes a word up to the line that holds it", () => {
    const stage = mount(
      `<p id="line"><span style="display:inline-block">Change</span><span style="display:inline-block">your</span><span style="display:inline-block">mind</span></p>`
    );

    expect(climb(pick("span:nth-child(3)"), stage).id).toBe("line");
  });

  it("takes a letter all the way up through its word", () => {
    const stage = mount(
      `<p id="line"><span style="display:inline-block"><i style="display:inline-block">m</i><i style="display:inline-block">i</i></span><span style="display:inline-block"><i style="display:inline-block">l</i></span></p>`
    );

    expect(climb(pick("i"), stage).id).toBe("line");
  });

  it("climbs out of a wrapper that has no siblings at all", () => {
    const stage = mount(
      `<p id="line"><span style="display:inline-block"><span style="display:inline">mind</span></span></p>`
    );

    expect(climb(pick("span span"), stage).id).toBe("line");
  });

  it("takes a line made of a single word", () => {
    const stage = mount(
      `<p id="line"><span style="display:inline-block">Change</span></p>`
    );

    expect(climb(pick("span"), stage).id).toBe("line");
  });

  it("stops at a word that paints itself, which is its own thing", () => {
    const stage = mount(
      `<p id="line"><span style="display:inline-block">Change</span><span id="chip" style="display:inline-block;background-color:rgb(240,240,240)">mind</span></p>`
    );

    expect(climb(pick("#chip"), stage).id).toBe("chip");
  });

  it("leaves a card where it is, even in a grid of cards", () => {
    const stage = mount(
      `<div><div id="card" style="display:block">Auth</div><div style="display:block">Swap</div></div>`
    );

    expect(climb(pick("#card"), stage).id).toBe("card");
  });

  it("never climbs past the container", () => {
    const stage = mount(
      `<span style="display:inline-block">a</span><span style="display:inline-block">b</span>`
    );

    expect(climb(pick("span"), stage)).toBe(pick("span"));
  });

  it("leaves an element whose parent is outside the container alone", () => {
    mount("<p><span>only</span></p>");

    expect(climb(pick("span"), pick("p"))).toBe(pick("span"));
  });
});

describe("svg, which is a picture and not a wrapper", () => {
  const ICON = `<svg id="icon" viewBox="0 0 10 10"><g id="group"><path id="glyph" d="M0 0h10v10z" fill="red" /></g></svg>`;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("knows an svg element by its namespace, not its tag case", () => {
    mount(ICON);

    expect(pick("#icon").tagName).toBe("svg");
    expect(isDrawing(pick("#icon"))).toBe(true);
    expect(isDrawing(pick("#glyph"))).toBe(true);
  });

  it("counts anything inside a drawing as painting", () => {
    mount(ICON);

    expect(paints(pick("#icon"), 0, 0)).toBe(true);
    expect(paints(pick("#glyph"), 0, 0)).toBe(true);
  });

  it("never treats a drawing as an inline wrapper to climb out of", () => {
    mount(ICON);

    expect(isInlineWrapper(pick("#icon"))).toBe(false);
    expect(isInlineWrapper(pick("#glyph"))).toBe(false);
  });

  it("takes a shape up to the picture that holds it", () => {
    const stage = mount(ICON);

    expect(climb(pick("#glyph"), stage).id).toBe("icon");
    expect(climb(pick("#group"), stage).id).toBe("icon");
  });

  it("leaves the picture itself alone", () => {
    const stage = mount(ICON);

    expect(climb(pick("#icon"), stage).id).toBe("icon");
  });

  it("takes the outermost picture when one is nested in another", () => {
    mount(
      `<svg id="outer" viewBox="0 0 10 10"><svg id="inner" viewBox="0 0 5 5"><path id="glyph" d="M0 0h5v5z" /></svg></svg>`
    );

    expect(svgRootOf(pick("#glyph"))?.id).toBe("outer");
  });

  it("reaches a drawing even when an inline wrapper sits around it", () => {
    const stage = mount(
      `<p><span style="display:inline-block">${ICON}</span></p>`
    );

    expect(climb(pick("#glyph"), stage).id).toBe("icon");
  });

  it("leaves html inside a foreignObject to the ordinary rules", () => {
    mount(
      `<svg viewBox="0 0 10 10"><foreignObject><span id="inner" style="display:inline-block">hi</span></foreignObject></svg>`
    );

    expect(isDrawing(pick("#inner"))).toBe(false);
    expect(svgRootOf(pick("#inner"))).toBeNull();
  });
});
