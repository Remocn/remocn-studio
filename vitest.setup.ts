import "@testing-library/jest-dom/vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class InertObserver {
  disconnect = () => undefined;
  observe = () => undefined;
  takeRecords = () => [];
  unobserve = () => undefined;
}

globalThis.ResizeObserver ??= InertObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  InertObserver as unknown as typeof IntersectionObserver;

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
