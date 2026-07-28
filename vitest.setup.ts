import "@testing-library/jest-dom/vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library gives `findBy*` and `waitFor` one second. That is the whole
// budget for a mount that fakes IPC, and on a loaded machine — CI, or a local
// build running alongside — a dozen suites time out at 1005ms with nothing
// wrong. The number buys headroom for a slow machine; it does not slow a fast
// one down, because a passing query resolves on the first poll either way.
configure({ asyncUtilTimeout: 5000 });

class InertObserver {
  disconnect = () => undefined;
  observe = () => undefined;
  takeRecords = () => [];
  unobserve = () => undefined;
}

globalThis.ResizeObserver ??= InertObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  InertObserver as unknown as typeof IntersectionObserver;

// jsdom ships no `matchMedia`, and anything that respects
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

// jsdom is not a Tauri webview: there is no `window.__TAURI_INTERNALS__`, so any
// `invoke()` reaching the real transport throws. Tests that render components
// touching IPC must install a fake with `mockIPC(...)` from
// `@tauri-apps/api/mocks`; this teardown makes sure one test's fake cannot leak
// into the next.
// Suites that reach for Node built-ins the client environment refuses to bundle
// — `node:sqlite` in the history store — opt into `@vitest-environment node`,
// where there is no `window` for either of these to clean up.
afterEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  cleanup();
  clearMocks();
});
