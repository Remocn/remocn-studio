import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { Composer } from "@/hooks/use-composer";
import { type ToolSettings, useTools } from "@/hooks/use-tools";
import { previewControl } from "@/test/preview-channel";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

const PROJECT = "project-1";

function harness(options: { isDocs?: boolean } = {}) {
  stubGlobal("requestAnimationFrame", () => 1);
  stubGlobal("cancelAnimationFrame", () => undefined);

  const { preview } = previewControl();

  const composer = {
    select: mock(() => "selection-1"),
    selections: { items: [], markStale: mock() },
  } as unknown as Composer;

  const settings = (isDocs: boolean): ToolSettings => ({
    composer,
    isDocs,
    isMissing: false,
    isShown: true,
    isWaiting: false,
    openedProjectId: PROJECT,
    preview,
    previewProjectId: PROJECT,
  });

  return renderHook(
    (props: { isDocs: boolean }) => useTools(settings(props.isDocs)),
    {
      initialProps: { isDocs: options.isDocs ?? false },
    }
  );
}

afterEach(() => {
  unstubAllGlobals();
  mock.restore();
});

describe("useTools in Docs", () => {
  it("arms Inspect while the pane is showing the preview", () => {
    const { result } = harness();

    act(() => result.current.inspect.toggle());

    expect(result.current.inspect.isArmed).toBe(true);
  });

  // The mode's tools point at pixels that are no longer on screen, so moving
  // to Docs disarms whatever was armed, down the path a rebuild takes.
  it("disarms Inspect when the pane moves to the documents", () => {
    const { rerender, result } = harness();

    act(() => result.current.inspect.toggle());
    expect(result.current.inspect.isArmed).toBe(true);

    rerender({ isDocs: true });

    expect(result.current.inspect.isArmed).toBe(false);
    expect(result.current.inspect.canInspect).toBe(false);
    expect(result.current.inspect.unavailable).toBe(
      "The pane is showing the documents."
    );
  });

  it("refuses to arm Snapshot while the documents are on screen", () => {
    const { result } = harness({ isDocs: true });

    act(() => result.current.snapshot.toggle());

    expect(result.current.snapshot.isArmed).toBe(false);
    expect(result.current.snapshot.canSnapshot).toBe(false);
  });
});

describe("useTools with nothing in the way", () => {
  it("offers Inspect and Snapshot with no account and no plan", () => {
    const { result } = harness();

    expect(result.current.inspect.canInspect).toBe(true);
    expect(result.current.snapshot.canSnapshot).toBe(true);
    expect(result.current.inspect.unavailable).toBeNull();

    act(() => result.current.snapshot.toggle());
    expect(result.current.snapshot.isArmed).toBe(true);
  });
});
