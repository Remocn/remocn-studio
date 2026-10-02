import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useUpdates } from "@/hooks/use-updates";

function core(environment: "development" | "production") {
  const asked: string[] = [];
  mockIPC((command) => {
    asked.push(command);
    if (command === "studio_build") {
      return { environment, os: "Ubuntu 24.04.1 LTS", version: "1.1.0" };
    }
    return null;
  });
  return asked;
}

const updaterCalls = (asked: readonly string[]) =>
  asked.filter((command) => command.startsWith("plugin:updater"));

describe("useUpdates", () => {
  it("never checks a production build, and says how a new version arrives", async () => {
    const asked = core("production");
    const { result } = renderHook(() => useUpdates());

    await waitFor(() => expect(result.current.version).toBe("1.1.0"));
    await result.current.check();

    expect(result.current.unavailable).toBe(
      "New versions arrive as a new download from the releases page, or through your package manager"
    );
    expect(result.current.os).toBe("Ubuntu 24.04.1 LTS");
    expect(result.current.hasChecked).toBe(false);
    expect(updaterCalls(asked)).toEqual([]);
  });

  it("keeps the development sentence for a development build", async () => {
    const asked = core("development");
    const { result } = renderHook(() => useUpdates());

    await waitFor(() =>
      expect(result.current.unavailable).toBe(
        "This is a development build — it updates when you rebuild it"
      )
    );
    expect(updaterCalls(asked)).toEqual([]);
  });

  it("waits for the core before saying anything else", () => {
    mockIPC(() => new Promise(() => undefined));
    const { result } = renderHook(() => useUpdates());

    expect(result.current.unavailable).toBe("Waiting for the Tauri core");
  });
});
