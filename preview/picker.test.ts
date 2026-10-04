import { beforeEach, describe, expect, it } from "bun:test";
import { type TestSurface, withSurface } from "@/test/surface";
import {
  climb,
  covers,
  coversText,
  hasBorder,
  isDrawing,
  isInlineWrapper,
  isTransparent,
  nearText,
  paints,
  pickAt,
  svgRootOf,
} from "./picker";

const HTML_NS = "http://www.w3.org/1999/xhtml";

const foreignObjectHoldsHtml = (() => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<foreignObject><span>x</span></foreignObject>";
  return svg.querySelector("span")?.namespaceURI === HTML_NS;
})();

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

function mount(html: string): HTMLElement {
  surface.root.innerHTML = `<div id="stage">${html}</div>`;
  const stage = surface.root.getElementById("stage");
  if (stage === null) {
    throw new Error("the stage did not mount");
  }
  return stage;
}

function pick(selector: string): Element {
  const found = surface.root.querySelector(selector);
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
    surface.root.replaceChildren();
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
    surface.root.replaceChildren();
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
    surface.root.replaceChildren();
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

  it.skipIf(!foreignObjectHoldsHtml)(
    "leaves html inside a foreignObject to the ordinary rules",
    () => {
      mount(
        `<svg viewBox="0 0 10 10"><foreignObject><span id="inner" style="display:inline-block">hi</span></foreignObject></svg>`
      );

      expect(isDrawing(pick("#inner"))).toBe(false);
      expect(svgRootOf(pick("#inner"))).toBeNull();
    }
  );
});

describe("covers", () => {
  function sized(box: {
    height: number;
    left: number;
    top: number;
    width: number;
  }): Element {
    mount("<div id='box'></div>");
    const element = pick("#box");

    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({
        ...box,
        bottom: box.top + box.height,
        right: box.left + box.width,
      }),
    });

    return element;
  }

  it("takes a point over the box, even when another element is on top", () => {
    const box = sized({ height: 100, left: 10, top: 20, width: 200 });

    expect(covers(box, 10, 20)).toBe(true);
    expect(covers(box, 210, 120)).toBe(true);
    expect(covers(box, 110, 115)).toBe(true);
  });

  it("leaves a point outside the box alone", () => {
    const box = sized({ height: 100, left: 10, top: 20, width: 200 });

    expect(covers(box, 9, 60)).toBe(false);
    expect(covers(box, 211, 60)).toBe(false);
    expect(covers(box, 110, 19)).toBe(false);
    expect(covers(box, 110, 121)).toBe(false);
  });

  it("never claims a box that is not laid out", () => {
    const box = sized({ height: 0, left: 0, top: 0, width: 0 });

    expect(covers(box, 0, 0)).toBe(false);
  });
});

interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

const FRAME: Box = { height: 600, left: 0, top: 0, width: 1000 };

const textRects = new Map<Node, Box[]>();

function rectOf(box: Box) {
  return {
    ...box,
    bottom: box.top + box.height,
    right: box.left + box.width,
    x: box.left,
    y: box.top,
  };
}

function boxed(element: Element, box: Box): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rectOf(box),
  });
}

function textAt(element: Element, ...boxes: Box[]): void {
  const node = element.firstChild;
  if (node === null) {
    throw new Error("the fixture element holds no text");
  }
  textRects.set(node, boxes);
}

function under(...elements: Element[]): void {
  surface.pointAt(elements);
}

function stageFor(html: string): HTMLElement {
  const stage = mount(html);
  boxed(stage, FRAME);
  return stage;
}

function installRects(): void {
  textRects.clear();
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value(this: Range) {
      return (textRects.get(this.startContainer) ?? []).map(rectOf);
    },
  });
}

describe("nearText, which reads the words a line is made of", () => {
  beforeEach(() => {
    surface.root.replaceChildren();
    installRects();
  });

  it("takes a point in the gap between two words of one line", () => {
    stageFor(
      `<div id="line" style="display:block;font-size:40px"><span style="display:inline-block">Change</span><span style="display:inline-block">your</span></div>`
    );
    const line = pick("#line");
    textAt(pick("span:nth-child(1)"), {
      height: 50,
      left: 100,
      top: 100,
      width: 100,
    });
    textAt(pick("span:nth-child(2)"), {
      height: 50,
      left: 220,
      top: 100,
      width: 80,
    });

    expect(nearText(line, 210, 120)).toBe(true);
  });

  it("keeps coversText literal, which is nearText with no allowance", () => {
    stageFor(
      `<div id="line" style="display:block;font-size:40px"><span style="display:inline-block">Change</span></div>`
    );
    const line = pick("#line");
    textAt(pick("span"), { height: 50, left: 100, top: 100, width: 100 });

    expect(coversText(line, 210, 120)).toBe(false);
    expect(coversText(line, 150, 120)).toBe(true);
  });

  it("skips a word that has not been revealed yet", () => {
    stageFor(
      `<div id="line" style="display:block;font-size:40px"><span id="unrevealed" style="display:inline-block;opacity:0">Change</span></div>`
    );
    textAt(pick("#unrevealed"), {
      height: 50,
      left: 100,
      top: 100,
      width: 100,
    });

    expect(nearText(pick("#line"), 150, 120)).toBe(false);
  });

  it("skips a word whose line was hidden outright", () => {
    stageFor(
      `<div id="line" style="display:block;font-size:40px;visibility:hidden"><span style="display:inline-block">Change</span></div>`
    );
    textAt(pick("span"), { height: 50, left: 100, top: 100, width: 100 });

    expect(nearText(pick("#line"), 150, 120)).toBe(false);
  });
});

describe("paints, which refuses what the frame does not show", () => {
  beforeEach(() => {
    surface.root.replaceChildren();
    installRects();
  });

  it("refuses an element that has faded out", () => {
    stageFor(
      `<div id="glow" style="background-color:rgb(9,9,9);opacity:0.01"></div>`
    );

    expect(paints(pick("#glow"), 10, 10)).toBe(false);
  });

  it("refuses an element that is not visible", () => {
    stageFor(
      `<div id="glow" style="background-color:rgb(9,9,9);visibility:hidden"></div>`
    );

    expect(paints(pick("#glow"), 10, 10)).toBe(false);
  });

  it("refuses a masked surface where it shows no text", () => {
    stageFor(
      `<div id="ghost" style="background-color:rgb(20,20,20);mask-image:url(mark.png)"></div>`
    );

    expect(paints(pick("#ghost"), 10, 10)).toBe(false);
  });

  it("keeps a masked surface where it does show text", () => {
    stageFor(
      `<div id="ghost" style="background-color:rgb(20,20,20);font-size:40px;mask-image:url(mark.png)">mind</div>`
    );
    textAt(pick("#ghost"), { height: 50, left: 100, top: 100, width: 100 });

    expect(paints(pick("#ghost"), 150, 120)).toBe(true);
  });
});

describe("pickAt over the shapes the corpus really has", () => {
  beforeEach(() => {
    surface.root.replaceChildren();
    installRects();
  });

  it("WordPush: a point in a word gap picks the line, not the backdrop", () => {
    const stage = stageFor(
      `<div id="backdrop" style="background-color:rgb(10,10,10)"></div><div id="line" style="display:block;font-size:40px"><span id="w1" style="display:inline-block">Change</span><span id="w2" style="display:inline-block">your</span></div>`
    );
    const line = pick("#line");
    const backdrop = pick("#backdrop");
    boxed(backdrop, FRAME);
    boxed(line, { height: 50, left: 100, top: 100, width: 200 });
    textAt(pick("#w1"), { height: 50, left: 100, top: 100, width: 100 });
    textAt(pick("#w2"), { height: 50, left: 220, top: 100, width: 80 });
    under(line, backdrop, stage);

    expect(pickAt(210, 120, stage, false)).toBe(line);
  });

  it("WordPush: a point on a word picks its line, and Alt keeps the word", () => {
    const stage = stageFor(
      `<div id="backdrop" style="background-color:rgb(10,10,10)"></div><div id="line" style="display:block;font-size:40px"><span id="w1" style="display:inline-block">Change</span><span id="w2" style="display:inline-block">your</span></div>`
    );
    const word = pick("#w1");
    boxed(pick("#backdrop"), FRAME);
    textAt(word, { height: 50, left: 100, top: 100, width: 100 });
    under(word, pick("#line"), pick("#backdrop"), stage);

    expect(pickAt(150, 120, stage, false)).toBe(pick("#line"));
    expect(pickAt(150, 120, stage, true)).toBe(word);
  });

  it("Highlight: a glyph picks its line, bare marker picks the marker", () => {
    const stage = stageFor(
      `<div id="wrap" style="display:inline-flex;position:relative"><div id="marker" style="position:absolute;background-color:rgb(255,230,0)"></div><div id="copy" style="display:block;position:relative;font-size:40px"><span id="word" style="display:inline-block">mind</span></div></div>`
    );
    const marker = pick("#marker");
    boxed(marker, { height: 60, left: 90, top: 95, width: 220 });
    boxed(pick("#wrap"), { height: 60, left: 90, top: 95, width: 220 });
    textAt(pick("#word"), { height: 50, left: 100, top: 100, width: 100 });

    under(pick("#word"), pick("#copy"), marker, pick("#wrap"), stage);
    expect(pickAt(150, 120, stage, false)).toBe(pick("#copy"));
    expect(pickAt(150, 120, stage, true)).toBe(pick("#word"));

    under(marker, pick("#wrap"), stage);
    expect(pickAt(290, 120, stage, false)).toBe(marker);
    expect(pickAt(290, 120, stage, true)).toBe(marker);
  });

  it("AmbientField: a line beats the full-frame glow behind it", () => {
    const stage = stageFor(
      `<div id="scene" style="background-color:rgb(5,5,5)"><div id="glow" style="background-image:radial-gradient(circle, red, transparent)"></div><div id="line" style="display:block;font-size:40px">Revenue</div></div>`
    );
    const line = pick("#line");
    boxed(pick("#scene"), FRAME);
    boxed(pick("#glow"), { height: 1120, left: -260, top: -260, width: 1520 });
    boxed(line, { height: 50, left: 100, top: 280, width: 300 });
    textAt(line, { height: 50, left: 100, top: 280, width: 300 });
    under(line, pick("#glow"), pick("#scene"), stage);

    expect(pickAt(300, 300, stage, false)).toBe(line);
    expect(pickAt(300, 300, stage, true)).toBe(line);
  });

  it("AmbientField: empty canvas picks the glow itself", () => {
    const stage = stageFor(
      `<div id="scene" style="background-color:rgb(5,5,5)"><div id="glow" style="background-image:radial-gradient(circle, red, transparent)"></div></div>`
    );
    const glow = pick("#glow");
    boxed(pick("#scene"), FRAME);
    boxed(glow, { height: 1120, left: -260, top: -260, width: 1520 });
    under(glow, pick("#scene"), stage);

    expect(pickAt(900, 500, stage, false)).toBe(glow);
    expect(pickAt(900, 500, stage, true)).toBe(glow);
  });

  it("AmbientField: a glow in front loses to the smaller card under it", () => {
    const stage = stageFor(
      `<div id="scene" style="background-color:rgb(5,5,5)"><div id="card" style="display:block;background-color:rgb(30,30,30)"></div><div id="glow" style="background-image:radial-gradient(circle, red, transparent)"></div></div>`
    );
    const card = pick("#card");
    boxed(pick("#scene"), FRAME);
    boxed(pick("#glow"), { height: 1120, left: -260, top: -260, width: 1520 });
    boxed(card, { height: 200, left: 100, top: 100, width: 300 });
    under(pick("#glow"), card, pick("#scene"), stage);

    expect(pickAt(200, 200, stage, false)).toBe(card);
    expect(pickAt(200, 200, stage, true)).toBe(pick("#glow"));
  });

  it("Backdrop: a masked ghost box lets through what is behind it", () => {
    const stage = stageFor(
      `<div id="behind" style="background-color:rgb(9,9,9)"></div><div id="ghost" style="background-color:rgb(20,20,20);mask-image:url(mark.png)"></div>`
    );
    const ghost = pick("#ghost");
    const behind = pick("#behind");
    boxed(behind, { height: 300, left: 400, top: 200, width: 300 });
    boxed(ghost, { height: 400, left: 380, top: 180, width: 400 });
    under(ghost, behind, stage);

    expect(pickAt(500, 300, stage, false)).toBe(behind);
    expect(pickAt(500, 300, stage, true)).toBe(ghost);
  });

  it("Unrevealed word: the surface behind is picked while nothing shows", () => {
    const stage = stageFor(
      `<div id="surface" style="background-color:rgb(9,9,9)"></div><div id="line" style="display:block;font-size:40px"><span id="unrevealed" style="display:inline-block;opacity:0">Change</span><span id="revealed" style="display:inline-block">your</span></div>`
    );
    const plate = pick("#surface");
    boxed(plate, { height: 300, left: 0, top: 0, width: 400 });
    boxed(pick("#line"), { height: 50, left: 100, top: 100, width: 200 });
    textAt(pick("#unrevealed"), {
      height: 50,
      left: 100,
      top: 100,
      width: 100,
    });
    textAt(pick("#revealed"), { height: 50, left: 220, top: 100, width: 80 });

    under(pick("#unrevealed"), pick("#line"), plate, stage);
    expect(pickAt(120, 120, stage, false)).toBe(plate);
    expect(pickAt(120, 120, stage, true)).toBe(pick("#unrevealed"));

    under(pick("#revealed"), pick("#line"), plate, stage);
    expect(pickAt(250, 120, stage, false)).toBe(pick("#line"));
    expect(pickAt(250, 120, stage, true)).toBe(pick("#revealed"));
  });
});

describe("managed semantic picking", () => {
  it("selects the object root instead of an animated letter or SVG part", () => {
    const stage = stageFor(
      '<div data-studio-object="card" id="card"><span id="letter">H</span></div>'
    );
    under(pick("#letter"), pick("#card"), stage);
    expect(pickAt(10, 10, stage, false)).toBe(pick("#card"));
    expect(pickAt(10, 10, stage, true)).toBe(pick("#card"));
  });
  it("selects the nested object and respects hidden ancestor opacity", () => {
    const stage = stageFor(
      '<div data-studio-object="parent" id="parent"><div data-studio-object="child" id="child"><span id="letter">H</span></div></div>'
    );
    under(pick("#letter"), pick("#child"), pick("#parent"), stage);
    expect(pickAt(10, 10, stage, false)).toBe(pick("#child"));
    pick("#child").setAttribute("style", "opacity:0");
    expect(pickAt(10, 10, stage, false)).toBe(pick("#parent"));
  });
});
