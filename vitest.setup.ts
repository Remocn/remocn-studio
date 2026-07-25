import "@testing-library/jest-dom/vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom is not a Tauri webview: there is no `window.__TAURI_INTERNALS__`, so any
// `invoke()` reaching the real transport throws. Tests that render components
// touching IPC must install a fake with `mockIPC(...)` from
// `@tauri-apps/api/mocks`; this teardown makes sure one test's fake cannot leak
// into the next.
afterEach(() => {
  cleanup();
  clearMocks();
});
