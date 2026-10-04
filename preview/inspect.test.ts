import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { waitFor } from "@testing-library/react";
import { type TestSurface, withSurface } from "@/test/surface";
import {
  armInspect,
  clearSelection,
  componentAt,
  highlightManaged,
  highlightTarget,
  hoverManaged,
  nameOf,
  type Stage,
  TOP,
} from "./inspect";

const STAGE: Stage = {
  composition: () => "main",
  fps: () => 30,
  frame: () => 0,
  video: () => ({ durationInFrames: 90, fps: 30, height: 1080, width: 1920 }),
};

let surface: TestSurface;

beforeEach(() => {
  surface = withSurface();
});

function staged(): HTMLElement {
  const canvas = document.createElement("div");
  canvas.className = "__remotion-player";
  surface.root.append(canvas);
  return canvas;
}

describe("armInspect", () => {
  it("forces canvas hit-testing on only while armed", () => {
    staged();

    expect(armInspect(true, STAGE)).toBe("armed");

    const style = surface.root.querySelector("style[data-remocn-inspect]");
    expect(style?.textContent).toContain("pointer-events: auto !important");
    expect(style?.textContent).toContain(".__remotion-player");
    expect(
      document.head.querySelector("style[data-remocn-inspect]")
    ).toBeNull();

    expect(armInspect(false, STAGE)).toBe("disarmed");
    expect(surface.root.querySelector("style[data-remocn-inspect]")).toBeNull();
  });

  it("reports no-canvas without touching the surface", () => {
    expect(armInspect(true, STAGE)).toBe("no-canvas");
    expect(surface.root.querySelector("style[data-remocn-inspect]")).toBeNull();
  });
});

describe("what a pick reports", () => {
  function picking(
    stacks: Map<
      Element,
      { fileName: string; functionName: string; lineNumber: number }[]
    >
  ) {
    const asked: Element[] = [];
    surface.dispose();
    surface = withSurface({
      getStack: (element) => {
        asked.push(element);
        return Promise.resolve(stacks.get(element) ?? null);
      },
    });
    return asked;
  }

  function press(target: Element) {
    surface.pointAt([target]);
    surface.viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        altKey: true,
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      })
    );
  }

  it("reads the stack once and takes its first project frame as the source", async () => {
    const stacks = new Map();
    const asked = picking(stacks);
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ files: [] })
    );
    const canvas = staged();
    const inside = document.createElement("span");
    canvas.append(inside);
    stacks.set(inside, [
      {
        fileName: "/project/src/videos/intro/Title.tsx",
        functionName: "Title",
        lineNumber: 12,
      },
      {
        fileName: "/project/src/videos/intro/Scene.tsx",
        functionName: "Scene",
        lineNumber: 4,
      },
      {
        fileName: "/project/node_modules/remotion/index.js",
        functionName: "Sequence",
        lineNumber: 1,
      },
    ]);
    armInspect(true, STAGE);

    press(inside);
    const selection = await waitFor(() => {
      const found = surface.sent.find(
        (message) => message.type === "selection"
      );
      expect(found).toBeDefined();
      return found;
    });
    expect(asked).toEqual([inside]);
    expect(selection?.element).toEqual(
      expect.objectContaining({
        component: "Title",
        file: "/project/src/videos/intro/Title.tsx",
        line: 12,
        stack: ["Scene (/project/src/videos/intro/Scene.tsx:4)"],
      })
    );
    fetched.mockRestore();
  });
});

describe("what a click while armed is allowed to reach", () => {
  function stagedWithBar() {
    const canvas = staged();
    canvas.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
      }) as DOMRect;

    const bar = document.createElement("div");
    const inside = document.createElement("span");
    canvas.append(inside);
    surface.root.append(bar);

    return { bar, canvas, inside };
  }

  function pointAt(topmost: Element | undefined) {
    surface.pointAt(topmost === undefined ? [] : [topmost]);
  }

  function clicked() {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    surface.viewport.dispatchEvent(event);

    return event;
  }

  it("hands the transport bar its own clicks back", () => {
    const { bar } = stagedWithBar();
    pointAt(bar);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(false);
  });

  it("still swallows a click that lands on the frame itself", () => {
    const { inside } = stagedWithBar();
    pointAt(inside);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(true);
  });

  it("falls back to the canvas rectangle when nothing can be hit-tested", () => {
    stagedWithBar();
    pointAt(undefined);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(true);
  });

  it("drives the inspect cursor only while it is armed", () => {
    const { canvas } = stagedWithBar();
    canvas.style.cursor = "pointer";

    armInspect(true, STAGE);
    expect(canvas.style.getPropertyValue("--remocn-inspect-cursor")).toBe(
      "default"
    );

    armInspect(false, STAGE);
    expect(canvas.style.getPropertyValue("--remocn-inspect-cursor")).toBe("");
    expect(canvas.style.cursor).toBe("pointer");
  });
});

describe("componentAt", () => {
  function mounted(
    ...fibers: { props?: Record<string, unknown>; type?: unknown }[]
  ) {
    let fiber: unknown = null;
    for (const each of fibers) {
      fiber = {
        memoizedProps: each.props ?? null,
        return: fiber,
        type: each.type ?? null,
      };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  function named(name: string) {
    return { displayName: name };
  }

  it("names the interactive component you could actually tune", () => {
    const controls = {
      componentName: "Title",
      currentRuntimeValueDotNotation: {},
      overrideId: "title-1",
      schema: {},
    };

    expect(
      componentAt(
        mounted(
          { props: { controls }, type: named("Whatever") },
          { type: "div" }
        )
      )
    ).toBe("Title");
  });

  // The label used to read `RegularSequenceRefForwardingFunction.div`, which is
  // true and useless: it is the function every `<Sequence>` renders through.
  it("walks past Remotion's plumbing to the component that is really there", () => {
    expect(
      componentAt(
        mounted(
          { type: named("RisingText") },
          { type: named("withInteractivitySchema(TitleBase)") },
          { type: named("RegularSequenceRefForwardingFunction") },
          { type: named("AbsoluteFill") },
          { type: "div" }
        )
      )
    ).toBe("RisingText");
  });

  it("has no name for a tree that is all plumbing", () => {
    expect(
      componentAt(mounted({ type: named("Sequence") }, { type: "div" }))
    ).toBeNull();
  });
});

// The pane shows one link of the chain at a time and the switcher's names —
// `<Series>`, `CameraRig` — are words, not places. The box is drawn inside the
// preview document, beside the hover box and for the same reason.
describe("highlightTarget", () => {
  function armed() {
    const canvas = staged();
    armInspect(true, STAGE);

    return canvas;
  }

  function selectionBox(): HTMLElement | null {
    return surface.overlays.querySelector<HTMLElement>(
      "div[data-remocn-selection]"
    );
  }

  it("draws nothing for a target the selection never carried", () => {
    armed();
    highlightTarget("nobody", true);

    expect(selectionBox()?.style.display).toBe("none");
  });

  it("clears the box when the pane has nothing open", () => {
    armed();
    highlightTarget(null, false);

    expect(selectionBox()?.style.display).toBe("none");
  });

  it("survives being called with no session at all", () => {
    armInspect(false, STAGE);

    expect(() => highlightTarget("anything", true)).not.toThrow();
  });
});

describe("the selection box", () => {
  function armed() {
    const canvas = staged();
    armInspect(true, STAGE);

    return canvas;
  }

  function boxes(): HTMLElement[] {
    return [
      ...surface.overlays.querySelectorAll<HTMLElement>(
        "div[data-remocn-inspect]"
      ),
    ];
  }

  it("is a pair of its own, beside the hover pair", () => {
    armed();
    highlightTarget(null, true);

    expect(
      boxes().filter((node) => node.hasAttribute("data-remocn-selection"))
    ).toHaveLength(1);
  });

  it("stays in the document when the mode is turned off", () => {
    armed();
    highlightTarget(null, true);
    armInspect(false, STAGE);

    expect(
      surface.overlays.querySelector("div[data-remocn-selection]")
    ).not.toBeNull();
  });

  it("carries a pulse rule the browser can turn off for reduced motion", () => {
    armed();
    highlightTarget(null, true);

    const style = surface.overlays.querySelector(
      "style[data-remocn-selection]"
    );

    expect(style?.textContent).toContain("prefers-reduced-motion");
    expect(style?.textContent).toContain("remocn-selection-pulse");
  });

  it("is forgotten only when the page is rebuilt", () => {
    armed();

    expect(() => clearSelection()).not.toThrow();
    expect(
      surface.overlays.querySelector<HTMLElement>("div[data-remocn-selection]")
        ?.style.display
    ).toBe("none");
  });
});

describe("hovering an object from the list", () => {
  function armed() {
    const canvas = staged();
    armInspect(true, STAGE);

    return canvas;
  }

  function mounted(canvas: HTMLElement, id: string) {
    const element = document.createElement("div");
    element.setAttribute("data-studio-object", id);
    element.setAttribute("data-studio-video", "intro");
    element.setAttribute("data-studio-generation", "g1");
    spyOn(element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(40, 60, 200, 80)
    );
    canvas.append(element);

    return element;
  }

  function hoverBox(): HTMLElement | undefined {
    return [
      ...surface.overlays.querySelectorAll<HTMLElement>(
        "div[data-remocn-inspect]"
      ),
    ].find((node) => node.style.zIndex === String(TOP));
  }

  afterEach(() => {
    hoverManaged(null);
    highlightManaged(null, "intro", "g1");
  });

  it("outlines the mounted object the row names", () => {
    mounted(armed(), "title");
    hoverManaged("title");

    expect(hoverBox()?.style.display).toBe("block");
    expect(hoverBox()?.style.left).toBe("40px");
    expect(hoverBox()?.style.width).toBe("200px");
  });

  it("outlines nothing for an object that is not mounted", () => {
    mounted(armed(), "title");
    hoverManaged("price");

    expect(hoverBox()?.style.display).toBe("none");
  });

  it("hands the outline back when the row is left", () => {
    mounted(armed(), "title");
    hoverManaged("title");
    hoverManaged(null);

    expect(hoverBox()?.style.display).toBe("none");
  });

  it("does not outline the object that is already selected", () => {
    mounted(armed(), "title");
    highlightManaged("title", "intro", "g1");
    hoverManaged("title");

    expect(hoverBox()?.style.display).toBe("none");
  });
});

describe("nameOf", () => {
  function mounted(props: Record<string, unknown> | null) {
    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: { memoizedProps: props, return: null, type: null },
    });

    return node;
  }

  it("reads the name the agent wrote", () => {
    expect(
      nameOf(
        mounted({
          controls: {
            componentName: "<Interactive.Div>",
            currentRuntimeValueDotNotation: { name: "Pushed line" },
            overrideId: "div-1",
            schema: {},
          },
        })
      )
    ).toBe("Pushed line · div");
  });

  it("falls back to the component, without Remotion's brackets", () => {
    expect(
      nameOf(
        mounted({
          controls: {
            componentName: "<Interactive.Div>",
            currentRuntimeValueDotNotation: {},
            overrideId: "div-1",
            schema: {},
          },
        })
      )
    ).toBe("Div · div");
  });

  it("is the bare tag when nothing names it", () => {
    expect(nameOf(mounted(null))).toBe("div");
  });
});

afterEach(() => {
  armInspect(false, STAGE);
  clearSelection();
});
