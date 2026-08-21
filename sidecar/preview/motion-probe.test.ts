import { afterEach, describe, expect, it } from "vitest";
import { probeMotionTargets } from "./design";

interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

function rect(element: Element, box: Box): void {
  (element as HTMLElement).getBoundingClientRect = () =>
    ({
      bottom: box.y + box.height,
      height: box.height,
      left: box.x,
      right: box.x + box.width,
      top: box.y,
      width: box.width,
      x: box.x,
      y: box.y,
    }) as DOMRect;
}

function mount(html: string): void {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("probeMotionTargets", () => {
  it("resolves a unique data-design-id target with its box and id", () => {
    mount('<div data-design-id="orb" style="opacity: 0.5"></div>');
    const orb = document.querySelector("[data-design-id='orb']");
    if (orb === null) {
      throw new Error("fixture missing");
    }
    rect(orb, { height: 100, width: 100, x: 200.004, y: 50 });

    const [probe] = probeMotionTargets(["[data-design-id='orb']"]);

    expect(probe?.matches).toBe(1);
    expect(probe?.target).toMatchObject({
      bbox: { height: 100, width: 100, x: 200, y: 50 },
      designId: "orb",
      display: true,
      inFrame: true,
      opacity: 0.5,
      sized: true,
      visible: true,
    });
  });

  it("reports how many elements an ambiguous selector matched", () => {
    mount('<div class="card"></div><div class="card"></div>');

    expect(probeMotionTargets([".card"])).toEqual([
      { matches: 2, target: null },
    ]);
  });

  it("reports a selector that matched nothing", () => {
    mount("<div></div>");

    expect(probeMotionTargets(["[data-design-id='gone']"])).toEqual([
      { matches: 0, target: null },
    ]);
  });

  it("reads a selector that does not parse as matching nothing", () => {
    mount("<div></div>");

    expect(probeMotionTargets(["[data-design-id="])).toEqual([
      { matches: 0, target: null },
    ]);
  });

  it("sees display:none anywhere in the chain and multiplies opacity", () => {
    mount(
      '<div style="display: none; opacity: 0.5"><span id="word" style="opacity: 0.5">hi</span></div>'
    );
    const word = document.querySelector("#word");
    if (word === null) {
      throw new Error("fixture missing");
    }
    rect(word, { height: 20, width: 40, x: 10, y: 10 });

    const [probe] = probeMotionTargets(["#word"]);

    expect(probe?.target).toMatchObject({ display: false, opacity: 0.25 });
  });

  it("marks a box entirely outside the viewport as out of frame", () => {
    mount('<div data-design-id="ticker"></div>');
    const ticker = document.querySelector("[data-design-id='ticker']");
    if (ticker === null) {
      throw new Error("fixture missing");
    }
    rect(ticker, { height: 100, width: 400, x: window.innerWidth + 5, y: 0 });

    const [probe] = probeMotionTargets(["[data-design-id='ticker']"]);

    expect(probe?.target).toMatchObject({ inFrame: false, sized: true });
  });

  it("changes the fingerprint when the target's geometry moves", () => {
    mount('<div data-design-id="orb"><span>glow</span></div>');
    const orb = document.querySelector("[data-design-id='orb']");
    const glow = document.querySelector("span");
    if (orb === null || glow === null) {
      throw new Error("fixture missing");
    }
    rect(orb, { height: 100, width: 100, x: 100, y: 100 });
    rect(glow, { height: 20, width: 20, x: 110, y: 110 });

    const [before] = probeMotionTargets(["[data-design-id='orb']"]);
    const [still] = probeMotionTargets(["[data-design-id='orb']"]);
    rect(glow, { height: 20, width: 20, x: 160, y: 110 });
    const [after] = probeMotionTargets(["[data-design-id='orb']"]);

    expect(before?.target?.fingerprint).toBe(still?.target?.fingerprint);
    expect(after?.target?.fingerprint).not.toBe(before?.target?.fingerprint);
  });

  it("changes the fingerprint when only the text content changes", () => {
    mount('<div data-design-id="counter">10</div>');
    const counter = document.querySelector("[data-design-id='counter']");
    if (counter === null) {
      throw new Error("fixture missing");
    }
    rect(counter, { height: 40, width: 80, x: 100, y: 100 });

    const [before] = probeMotionTargets(["[data-design-id='counter']"]);
    counter.textContent = "42";
    const [after] = probeMotionTargets(["[data-design-id='counter']"]);

    expect(after?.target?.fingerprint).not.toBe(before?.target?.fingerprint);
  });
});
