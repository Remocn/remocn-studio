import { afterEach, expect } from "bun:test";
import { clearMocks } from "@tauri-apps/api/mocks";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, configure } from "@testing-library/react";
import { disposeSurfaces } from "./surface";

interface Utils {
  printExpected: (value: unknown) => string;
  printReceived: (value: unknown) => string;
  stringify: (value: unknown) => string;
}

interface MatcherContext {
  utils: Utils;
}

type Matcher = (this: MatcherContext, ...args: unknown[]) => unknown;

const OUTER_HTML_LIMIT = 400;

// bun's `expect` prints a received value by walking the whole object, and a
// happy-dom node is a graph of symbol-keyed internals: one failed jest-dom
// assertion on an element took 2.6 s to word, measured with JSC's sampler —
// which `waitFor` pays on every poll until the element goes away. Nodes are
// printed as their markup instead, the way pretty-format's DOM plugin does.
function printingNodes(print: Utils["stringify"]): Utils["stringify"] {
  return (value) => {
    if (value instanceof Element) {
      const html = value.outerHTML;
      return html.length > OUTER_HTML_LIMIT
        ? `${html.slice(0, OUTER_HTML_LIMIT)}…`
        : html;
    }
    if (value instanceof Node) {
      return value.nodeName;
    }
    return print(value);
  };
}

const patched = new WeakSet<Utils>();

function withCheapReceived(matcher: Matcher): Matcher {
  return function (this: MatcherContext, ...args) {
    const { utils } = this;
    if (!patched.has(utils)) {
      utils.stringify = printingNodes(utils.stringify);
      utils.printReceived = printingNodes(utils.printReceived);
      utils.printExpected = printingNodes(utils.printExpected);
      patched.add(utils);
    }
    return matcher.apply(this, args);
  };
}

expect.extend(
  Object.fromEntries(
    Object.entries(matchers).map(([name, matcher]) => [
      name,
      withCheapReceived(matcher as Matcher),
    ])
  ) as never
);

// Testing Library gives `findBy*` and `waitFor` one second. That is the whole
// budget for a mount that fakes IPC, and on a loaded machine — CI, or a local
// build running alongside — a dozen suites time out at 1005ms with nothing
// wrong. The number buys headroom for a slow machine; it does not slow a fast
// one down, because a passing query resolves on the first poll either way.
// GitHub's runner is about four times slower than the laptop the suite is
// measured on (51 s against 12 s for the same run) and its heaviest shell
// mounts crossed five seconds one file at a time, a different file each run.
configure({ asyncUtilTimeout: process.env.CI ? 10_000 : 5000 });

class InertObserver {
  disconnect = () => undefined;
  observe = () => undefined;
  takeRecords = () => [];
  unobserve = () => undefined;
}

globalThis.ResizeObserver ??= InertObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  InertObserver as unknown as typeof IntersectionObserver;

// happy-dom ships no `matchMedia`, and anything that respects
// `prefers-reduced-motion` calls it during mount — the Dot Matrix loader does.
// The stub always answers "no preference", which is the branch worth testing.
globalThis.matchMedia ??= ((media: string) => ({
  addEventListener: () => undefined,
  addListener: () => undefined,
  dispatchEvent: () => false,
  matches: false,
  media,
  onchange: null,
  removeEventListener: () => undefined,
  removeListener: () => undefined,
})) as typeof matchMedia;

// happy-dom implements no Web Animations API, so `Element.getAnimations` is
// missing. Base UI's scroll area calls it on a timer to wait its scrollbar
// fade out, and the throw lands outside any test as an unhandled rejection —
// every suite passes and the run still fails. Answering "nothing is animating"
// is the branch these tests want anyway.
Element.prototype.getAnimations ??= () => [];

// happy-dom defines `getContext` and answers null from it — so this is an
// assignment, not a `??=`. `MiddleTruncation` measures text through it and
// throws on null, which is what stops anything containing a truncated path —
// the New project dialog — from rendering in a test at all. The width is a
// stand-in: happy-dom lays out no text either, so a real measurement would be
// as fictional as this one.
HTMLCanvasElement.prototype.getContext = ((kind: string) =>
  kind === "2d"
    ? {
        font: "",
        measureText: (text: string) => ({ width: text.length * 7 }),
      }
    : null) as typeof HTMLCanvasElement.prototype.getContext;

// happy-dom is not a Tauri webview: there is no `window.__TAURI_INTERNALS__`,
// so any `invoke()` reaching the real transport throws. Tests that render
// components touching IPC must install a fake with `mockIPC(...)` from
// `@tauri-apps/api/mocks`; this teardown makes sure one test's fake cannot
// leak into the next.
afterEach(() => {
  cleanup();
  clearMocks();
  disposeSurfaces();
});
