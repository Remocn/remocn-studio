import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { Effect } from "effect";
import { useMemo, useRef } from "react";
import { previewControl } from "@/test/preview-channel";
import { useNativePreview } from "./use-native-preview";
import type { PreviewControl } from "./use-preview";

const started: string[] = [];
const disposed: string[] = [];

mock.module("@/lib/studio/native-preview", () => ({
  runNativePreview: (options: {
    url: string;
    onState: (state: unknown) => void;
  }) =>
    Effect.callback<void>(() => {
      started.push(options.url);
      options.onState({ phase: "ready", stale: null });
      return Effect.sync(() => {
        disposed.push(options.url);
      });
    }),
}));

// A fresh closure here would be a new dependency on every render, restarting
// runNativePreview forever the moment onState's setState causes one.
const noopAttach = () => () => undefined;

function preview(url: string): PreviewControl {
  return previewControl({
    attachSurface: noopAttach,
    preview: { phase: "ready", url },
  }).preview;
}

function Harness({ url }: { url: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  // The real usePreview() hook returns a useMemo'd PreviewControl whose
  // attachSurface is only as fresh as its inputs; a control rebuilt on every
  // render would re-run the mount effect forever, so the fake matches that
  // stability instead of recreating attachSurface every render.
  const control = useMemo(() => preview(url), [url]);
  const native = useNativePreview(control, viewport);
  return (
    <div>
      <div data-testid="viewport" ref={viewport} />
      <div ref={native.stage} />
      <div ref={native.overlays} />
    </div>
  );
}

const FIRST = "http://127.0.0.1:4000/native-abc?composition=Intro";
const SECOND = "http://127.0.0.1:4000/native-abc?composition=Outro";

describe("useNativePreview", () => {
  // The global afterEach in test/setup.ts also unmounts, but it runs after
  // this one, so an unmount left to it would push into arrays this test file
  // has already cleared for the next test. Unmounting here first keeps the
  // dispose it triggers inside this test's own accounting.
  afterEach(() => {
    cleanup();
    started.length = 0;
    disposed.length = 0;
  });

  it("starts the runtime once the preview and the stage are ready", () => {
    act(() => {
      render(<Harness url={FIRST} />);
    });

    expect(started).toEqual([FIRST]);
  });

  it("reloads the page for a new composition on the same host: the old runtime is disposed and a fresh one starts", async () => {
    let rerender!: (element: React.ReactElement) => void;
    await act(async () => {
      ({ rerender } = render(<Harness url={FIRST} />));
      await Promise.resolve();
    });

    await act(async () => {
      rerender(<Harness url={SECOND} />);
      await Promise.resolve();
    });

    expect(started).toEqual([FIRST, SECOND]);
    expect(disposed).toEqual([FIRST]);
  });

  it("does not start a second runtime when the same url is served again", async () => {
    let rerender!: (element: React.ReactElement) => void;
    await act(async () => {
      ({ rerender } = render(<Harness url={FIRST} />));
      await Promise.resolve();
    });

    await act(async () => {
      rerender(<Harness url={FIRST} />);
      await Promise.resolve();
    });

    expect(started).toEqual([FIRST]);
    expect(disposed).toEqual([]);
  });

  it("tears the runtime down when the canvas itself unmounts", async () => {
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<Harness url={FIRST} />));
      await Promise.resolve();
    });

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(disposed).toEqual([FIRST]);
  });
});
