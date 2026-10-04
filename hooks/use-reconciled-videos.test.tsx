import { afterEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useReconciledVideos } from "@/hooks/use-reconciled-videos";
import { EMPTY_COMPOSITIONS_SETTLE_MS } from "@/lib/studio/preview-channel";
import type { PreviewMessage } from "@/preview/protocol";
import { previewControl } from "@/test/preview-channel";

function message(compositions: readonly string[]): PreviewMessage {
  return {
    compositionId: compositions.at(0) ?? null,
    compositions,
    metadata: null,
    reason: compositions.length === 0 ? "none" : "first",
    total: compositions.length,
    trouble: null,
    type: "composition",
    unmeasured: false,
  };
}

function previewHarness() {
  const { preview, surface } = previewControl();

  return { deliver: surface.emit, preview };
}

afterEach(() => {
  jest.useRealTimers();
});

describe("useReconciledVideos", () => {
  it("deduplicates a composition registry that was already reconciled", () => {
    const reconcile = mock();
    const host = previewHarness();

    renderHook(() => useReconciledVideos(host.preview, "project-1", reconcile));

    act(() => host.deliver(message(["intro", "outro"])));
    act(() => host.deliver(message(["outro", "intro"])));

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith("project-1", ["intro", "outro"]);
  });

  it("reconciles a stabilized empty composition registry immediately", () => {
    jest.useFakeTimers();
    const reconcile = mock();
    const host = previewHarness();

    renderHook(() => useReconciledVideos(host.preview, "project-1", reconcile));

    act(() => host.deliver(message([])));
    act(() => jest.advanceTimersByTime(EMPTY_COMPOSITIONS_SETTLE_MS));

    expect(reconcile).toHaveBeenCalledWith("project-1", []);
  });
});
