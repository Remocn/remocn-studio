import { afterEach, expect, it } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBundledLibrary } from "./use-bundled-library";

afterEach(clearMocks);

it("reports a failed catalogue load and retries through the same library request", async () => {
  let attempts = 0;
  mockIPC((_command, payload) => {
    expect(payload).toMatchObject({ method: "library.bundled" });
    attempts += 1;
    if (attempts === 1) {
      throw new Error("Catalogue unavailable");
    }
    return [];
  });
  const { result } = renderHook(() => useBundledLibrary());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toContain("Catalogue unavailable");
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.assets).toEqual([]);
  expect(result.current.isLoading).toBe(false);
  expect(attempts).toBe(2);
});
