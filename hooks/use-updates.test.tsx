import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { INSTALLED_ELSEWHERE, useUpdates } from "@/hooks/use-updates";
import type { StudioBuild } from "@/shared/ipc";

const RELEASE: StudioBuild = {
  environment: "production",
  os: "Arch Linux",
  updatesInPlace: true,
  version: "1.0.1",
};

function core(build: StudioBuild): string[] {
  const asked: string[] = [];
  mockIPC((cmd) => {
    asked.push(cmd);
    if (cmd === "studio_build") {
      return build;
    }
    if (cmd === "plugin:updater|check") {
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return asked;
}

const updaterCalls = (asked: string[]) =>
  asked.filter((cmd) => cmd.startsWith("plugin:updater|"));

describe("useUpdates", () => {
  it("asks GitHub once when the studio opens as a release", async () => {
    const asked = core(RELEASE);
    const { result } = renderHook(() => useUpdates());

    await waitFor(() => expect(result.current.hasChecked).toBe(true));
    expect(result.current.unavailable).toBeNull();
    expect(updaterCalls(asked)).toEqual(["plugin:updater|check"]);
  });

  // An AUR package, or any Linux package that is not the release's own
  // AppImage, .deb or .rpm, clears the bundle marker; the updater would then
  // try to replace the executable pacman owns, so it is never asked.
  it("never asks GitHub for a build its package manager installed", async () => {
    const asked = core({ ...RELEASE, updatesInPlace: false });
    const { result } = renderHook(() => useUpdates());

    await waitFor(() =>
      expect(result.current.unavailable).toBe(INSTALLED_ELSEWHERE)
    );
    await result.current.check();
    expect(updaterCalls(asked)).toEqual([]);
  });
});
