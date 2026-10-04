import { describe, expect, it } from "bun:test";
import { displayName, type Fiber, fiberOf, nearestInFibers } from "./fiber";

function fiber(overrides: Partial<Fiber>): Fiber {
  return {
    child: null,
    memoizedProps: null,
    return: null,
    sibling: null,
    stateNode: null,
    type: null,
    ...overrides,
  };
}

/** A node carrying a fiber chain the way React attaches one. */
function mounted(chain: Fiber): HTMLElement {
  const node = document.createElement("div");
  Object.defineProperty(node, "__reactFiber$abc123", {
    configurable: true,
    enumerable: true,
    value: chain,
  });

  return node;
}

describe("fiberOf", () => {
  it("finds the fiber under React's per-render key", () => {
    const own = fiber({ type: "div" });

    expect(fiberOf(mounted(own))).toBe(own);
  });

  it("answers nothing for a node React never rendered", () => {
    expect(fiberOf(document.createElement("div"))).toBeNull();
  });
});

describe("nearestInFibers", () => {
  it("walks outwards and takes the innermost answer", () => {
    const outer = fiber({ memoizedProps: { mark: "outer" } });
    const inner = fiber({ memoizedProps: { mark: "inner" }, return: outer });
    const leaf = fiber({ return: inner });

    expect(
      nearestInFibers(mounted(leaf), (each) => each.memoizedProps?.mark ?? null)
    ).toBe("inner");
  });

  it("reaches the top of the chain when nothing nearer answers", () => {
    const outer = fiber({ memoizedProps: { mark: "outer" } });
    const leaf = fiber({ return: fiber({ return: outer }) });

    expect(
      nearestInFibers(mounted(leaf), (each) => each.memoizedProps?.mark ?? null)
    ).toBe("outer");
  });

  it("answers nothing when no fiber matches, and does not loop for ever", () => {
    const leaf = fiber({ return: fiber({}) });

    expect(nearestInFibers(mounted(leaf), () => null)).toBeNull();
    expect(nearestInFibers(document.createElement("p"), () => "x")).toBeNull();
  });
});

describe("displayName", () => {
  it("prefers an explicit displayName over the function name", () => {
    function Title() {
      return null;
    }
    Title.displayName = "Interactive(Title)";

    expect(displayName(fiber({ type: Title }))).toBe("Interactive(Title)");
  });

  it("falls back to the function name", () => {
    function RisingText() {
      return null;
    }

    expect(displayName(fiber({ type: RisingText }))).toBe("RisingText");
  });

  it("has no name for a host element or an empty one", () => {
    expect(displayName(fiber({ type: "div" }))).toBeNull();
    expect(displayName(fiber({ type: null }))).toBeNull();
    expect(displayName(fiber({ type: { displayName: "" } }))).toBeNull();
  });
});
