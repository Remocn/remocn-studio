import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PreviewControl } from "@/hooks/use-preview";
import type {
  PreviewComposition,
  PreviewMessageOf,
} from "@/lib/studio/preview";
import type { PreviewMessage } from "@/preview/protocol";
import { PREVIEW_URL, previewControl } from "@/test/preview-channel";
import {
  usePreviewTransport,
  useTransportEdge,
  useTransportFrame,
} from "./use-preview-transport";

const SCENES = [
  { duration: 90, from: 0, id: "a", name: "Intro" },
  { duration: 210, from: 90, id: "b", name: "Features" },
];

function picked(compositionId: string): PreviewComposition {
  return {
    compositionId,
    compositions: [compositionId],
    metadata: { durationInFrames: 300, fps: 30, height: 1080, width: 1920 },
    reason: "asked",
    source: "remocn-preview",
    total: 1,
    trouble: null,
    type: "composition",
    unmeasured: false,
  };
}

function setup() {
  const harness = previewControl();
  const preview = (composition: string, url: string): PreviewControl => ({
    ...harness.preview,
    composition,
    pick: picked(composition),
    preview: { phase: "ready", url },
  });
  const emit = (message: PreviewMessage) =>
    act(() => harness.surface.emit(message));
  const show = (composition: string) => emit(picked(composition));
  show("intro");
  const hook = renderHook(
    ({
      composition,
      url = PREVIEW_URL,
    }: {
      composition: string;
      url?: string;
    }) => usePreviewTransport(preview(composition, url), true),
    {
      initialProps: { composition: "intro" } as {
        composition: string;
        url?: string;
      },
    }
  );
  const rates = () =>
    harness.surface.sent.flatMap((command) =>
      command.type === "transport.rate" ? [command.rate] : []
    );
  return { ...hook, emit, harness, rates, show };
}

function stateOf(
  compositionId: string,
  volume: number
): PreviewMessageOf<"transport.state"> {
  return {
    buffering: false,
    compositionId,
    error: null,
    muted: false,
    source: "remocn-preview",
    type: "transport.state",
    volume,
  };
}

describe("usePreviewTransport scenes", () => {
  it("has no scenes until the runtime reports them", () => {
    const { result } = setup();

    expect(result.current.scenes).toEqual([]);
  });

  it("takes the scenes reported for the video on screen", () => {
    const { emit, result } = setup();
    emit({
      compositionId: "intro",
      scenes: SCENES,
      type: "scenes",
    });

    expect(result.current.scenes.map((scene) => scene.name)).toEqual([
      "Intro",
      "Features",
    ]);
  });

  it("ignores scenes reported for another video", () => {
    const { emit, rerender, result, show } = setup();
    emit({
      compositionId: "intro",
      scenes: SCENES,
      type: "scenes",
    });
    show("outro");
    rerender({ composition: "outro" });

    expect(result.current.scenes).toEqual([]);
  });
});

describe("usePreviewTransport scenes arriving early", () => {
  it("keeps scenes delivered with their video's composition, before the pane re-renders for it", () => {
    const { harness, rerender, result, show } = setup();
    show("previous");
    rerender({ composition: "previous" });
    act(() =>
      harness.surface.reveal([
        picked("intro"),
        { compositionId: "intro", scenes: SCENES, type: "scenes" },
      ])
    );
    rerender({ composition: "intro" });

    expect(result.current.scenes.map((scene) => scene.name)).toEqual([
      "Intro",
      "Features",
    ]);
  });

  it("drops scenes that arrive before their video's composition", () => {
    const { harness, rerender, result, show } = setup();
    show("previous");
    rerender({ composition: "previous" });
    act(() =>
      harness.surface.reveal([
        { compositionId: "intro", scenes: SCENES, type: "scenes" },
        picked("intro"),
      ])
    );
    rerender({ composition: "intro" });

    expect(result.current.scenes).toEqual([]);
  });
});

describe("usePreviewTransport across a video switch", () => {
  const OUTRO_URL = "http://127.0.0.1:51749/?composition=outro";

  it("never shows the last video's transport as the next one's", () => {
    const { emit, harness, rerender, result } = setup();
    emit(stateOf("intro", 0.3));

    expect(result.current.ready).toBe(true);
    expect(result.current.volume).toBe(30);

    act(() => {
      harness.preview.channel.serve(OUTRO_URL);
      harness.surface.reveal([
        { type: "rebuilt" },
        { ids: [], type: "studio.present" },
        {
          compositionId: null,
          compositions: [],
          metadata: null,
          reason: "asked",
          total: 0,
          trouble: null,
          type: "composition",
          unmeasured: false,
        },
        picked("outro"),
        stateOf("intro", 0.3),
        { compositionId: "outro", scenes: SCENES, type: "scenes" },
      ]);
    });
    rerender({ composition: "outro", url: OUTRO_URL });

    expect(result.current.ready).toBe(false);
    expect(result.current.volume).toBe(100);
    expect(result.current.scenes).toHaveLength(2);

    emit(stateOf("outro", 0.6));

    expect(result.current.ready).toBe(true);
    expect(result.current.volume).toBe(60);
  });
});

describe("usePreviewTransport speed", () => {
  it("starts at 1x and sends a chosen speed to the runtime", () => {
    const { rates, result } = setup();

    expect(result.current.rate).toBe(1);

    act(() => result.current.setRate(0.25));

    expect(result.current.rate).toBe(0.25);
    expect(rates().at(-1)).toBe(0.25);
  });

  it("moves between the speeds by step, as the slider does", () => {
    const { result } = setup();

    expect(result.current.rateStep).toBe(2);
    expect(result.current.rateMarks).toEqual([0, 1 / 3, 2 / 3, 1]);

    act(() => result.current.setRateStep(0));

    expect(result.current.rate).toBe(0.25);

    act(() => result.current.setRateStep(9));

    expect(result.current.rate).toBe(0.25);
  });

  it("cycles through the speeds from the compact button, wrapping at the end", () => {
    const { result } = setup();

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(2);

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(0.25);

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(0.5);
  });

  it("sends the speed again to a rebuilt runtime", () => {
    const { emit, rates, result } = setup();
    act(() => result.current.setRate(0.5));
    const before = rates().length;
    emit({ type: "rebuilt" });

    expect(rates().length).toBe(before + 1);
    expect(rates().at(-1)).toBe(0.5);
  });

  it("plays another video at 1x", () => {
    const { rates, rerender, result, show } = setup();
    act(() => result.current.setRate(2));
    show("outro");
    rerender({ composition: "outro" });

    expect(result.current.rate).toBe(1);
    expect(rates().at(-1)).toBe(1);
  });
});

describe("usePreviewTransport playhead", () => {
  it("keeps the transport still while frames play, and the seek bar follows them", () => {
    const clock = { frame: 0 };
    const watchers = new Set<() => void>();
    const { preview } = previewControl({
      composition: "intro",
      frameOf: () => clock.frame,
      onFrame: (listen: () => void) => {
        watchers.add(listen);
        return () => {
          watchers.delete(listen);
        };
      },
      pick: picked("intro"),
      playing: true,
    });
    let renders = 0;
    const transport = renderHook(() => {
      renders += 1;
      return usePreviewTransport(preview, true);
    });
    const seekBar = renderHook(() => ({
      edge: useTransportEdge(transport.result.current),
      shown: useTransportFrame(transport.result.current),
    }));
    const before = { renders, seekTo: transport.result.current.seekTo };

    for (const frame of [30, 60, 299]) {
      act(() => {
        clock.frame = frame;
        for (const listen of watchers) {
          listen();
        }
      });
    }

    expect(renders).toBe(before.renders);
    expect(transport.result.current.seekTo).toBe(before.seekTo);
    expect(seekBar.result.current.shown).toEqual({
      frame: 299,
      position: "00:09",
    });
    expect(seekBar.result.current.edge).toBe("end");
  });
});
