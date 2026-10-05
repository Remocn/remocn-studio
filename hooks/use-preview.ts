"use client";

import { Effect, Fiber } from "effect";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { previewFailure, previewRecovery } from "@/lib/studio/failures";
import {
  type MessageType,
  type PreviewComposition,
  type PreviewMessageOf,
  startPreview,
} from "@/lib/studio/preview";
import {
  createPreviewChannel,
  type PreviewChannel,
  type PreviewEpoch,
  type PreviewSurface,
} from "@/lib/studio/preview-channel";
import type { PromptFrame, SidecarPhase } from "@/shared/ipc";

export type Preview =
  | { phase: "building"; percent: number }
  | { phase: "failed"; message: string }
  | { phase: "idle" }
  | { phase: "ready"; url: string };

export interface PreviewControl {
  attachSurface: (surface: PreviewSurface) => () => void;
  channel: PreviewChannel;
  composition: string | null;
  focus: () => void;
  frameOf: () => number;
  hint: string | null;
  isServing: boolean;
  onFrame: (listen: () => void) => () => void;
  pick: PreviewComposition | null;
  playing: boolean;
  preview: Preview;
  restart: () => void;
}

const IDLE: Preview = { phase: "idle" };

type Running = Fiber.Fiber<unknown, unknown>;

// One host per project, one runtime per video: the bundle is shared and the
// canvas asks for the composition it wants, so switching videos is a remount
// rather than another seven-second compile.
export function usePreview(
  projectId: string | null,
  compositionId: string | null,
  sidecarPhase: SidecarPhase | "unknown",
  projectPath?: string
): PreviewControl {
  const [preview, setPreview] = useState<Preview>(IDLE);
  const [pick, setPick] = useState<PreviewComposition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const running = useRef<Running | null>(null);
  const channel = useMemo(createPreviewChannel, []);
  const frame = useRef(0);
  const watchers = useRef(new Set<() => void>());

  const frameOf = useCallback(() => frame.current, []);

  const onFrame = useCallback((listen: () => void) => {
    watchers.current.add(listen);

    return () => {
      watchers.current.delete(listen);
    };
  }, []);

  const setFrame = useCallback((at: number) => {
    if (frame.current === at) {
      return;
    }

    frame.current = at;
    for (const watch of [...watchers.current]) {
      watch();
    }
  }, []);

  const url =
    preview.phase === "ready" ? playing(preview.url, compositionId) : null;

  const stop = useCallback(() => {
    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
      running.current = null;
    }
  }, []);

  const launch = useCallback(
    (target: string) => {
      let served = false;
      let failed = false;

      setPick(null);
      setFrame(0);
      setIsPlaying(false);
      setPreview({ percent: 0, phase: "building" });

      running.current = Effect.runFork(
        startPreview({ projectId: target }, (event) => {
          if (event.type === "building") {
            // A compile that failed still ticks to 100% afterwards; only a
            // fresh compile, starting from nothing, takes the error down.
            if (served || (failed && event.percent > 0)) {
              return;
            }
            failed = false;
            setPreview({ percent: event.percent, phase: "building" });
            return;
          }
          if (event.type === "ready") {
            served = true;
            failed = false;
            setPreview({ phase: "ready", url: event.url });
            return;
          }
          served = false;
          failed = true;
          setPreview({
            message: previewFailure(event.message),
            phase: "failed",
          });
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              setPreview({
                message: previewFailure(error.message),
                phase: "failed",
              });
            })
          )
        )
      );
    },
    [setFrame]
  );

  useEffect(() => {
    if (projectId === null) {
      setPick(null);
      setPreview(IDLE);
      return;
    }

    launch(projectId);

    return stop;
  }, [launch, projectId, stop]);

  // The preview's request dies with the sidecar and nothing brought it back,
  // so the one pane that costs seven seconds to rebuild was the only one left
  // needing a manual click. `lost` survives the render that sets it, because
  // the crash and the recovery are two separate status events.
  const lost = useRef(false);

  useEffect(() => {
    const next = previewRecovery(lost.current, sidecarPhase);
    lost.current = next.lost;

    if (next.relaunch && projectId !== null) {
      stop();
      launch(projectId);
    }
  }, [launch, projectId, sidecarPhase, stop]);

  useEffect(() => channel.serve(url), [channel, url]);

  useEffect(() => {
    const stops = [
      channel.on("composition", setPick),
      channel.on("playhead", (message) => {
        setIsPlaying(message.playing);
        setFrame(message.frame);
      }),
      channel.on("capture", (message) => setFrame(message.frame)),
      channel.on("selection", (message) => setFrame(message.element.frame)),
    ];
    return () => {
      for (const off of stops) {
        off();
      }
    };
  }, [channel, setFrame]);

  useEffect(() => () => channel.disconnect(), [channel]);

  const restart = useCallback(() => {
    stop();
    if (projectId !== null) {
      launch(projectId);
    }
  }, [launch, projectId, stop]);

  const previousLocation = useRef({ projectId, projectPath });
  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = { projectId, projectPath };
    if (
      previous.projectId === projectId &&
      previous.projectPath !== projectPath
    ) {
      restart();
    }
  }, [projectId, projectPath, restart]);

  const hint = useMemo(() => hintOf(pick), [pick]);

  return useMemo(
    () => ({
      attachSurface: channel.attach,
      channel,
      composition: pick?.compositionId ?? null,
      focus: channel.focus,
      frameOf,
      hint,
      isServing: preview.phase === "ready",
      onFrame,
      pick,
      playing: isPlaying,
      preview: url === null ? preview : { phase: "ready" as const, url },
      restart,
    }),
    [channel, frameOf, hint, isPlaying, onFrame, pick, preview, restart, url]
  );
}

function playing(url: string, compositionId: string | null): string {
  if (compositionId === null) {
    return url;
  }

  const asked = new URL(url);
  asked.searchParams.set("composition", compositionId);
  return asked.toString();
}

export function usePlayingFrame(
  preview: PreviewControl
): () => PromptFrame | null {
  const { composition, frameOf } = preview;
  const open = useRef(composition);
  open.current = composition;

  return useCallback(
    () =>
      open.current === null
        ? null
        : { composition: open.current, frame: frameOf() },
    [frameOf]
  );
}

export type PreviewFrames = Pick<PreviewControl, "frameOf" | "onFrame">;

export function usePreviewFrame(preview: PreviewFrames): number {
  const { frameOf, onFrame } = preview;

  return useSyncExternalStore(onFrame, frameOf, frameOf);
}

export function usePreviewMessage<T extends MessageType>(
  preview: Pick<PreviewControl, "channel">,
  type: T,
  handle: (message: PreviewMessageOf<T>) => void
): void {
  const { channel } = preview;

  useEffect(() => channel.on(type, handle), [channel, handle, type]);
}

export function usePreviewEpoch(
  preview: Pick<PreviewControl, "channel">
): PreviewEpoch {
  const { channel } = preview;

  return useSyncExternalStore(channel.onEpoch, channel.epoch, channel.epoch);
}

export type ReportScope = "build" | "video";

export function usePreviewReport<T extends MessageType>(
  preview: Pick<PreviewControl, "channel">,
  type: T,
  scope: ReportScope
): PreviewMessageOf<T> | null {
  const { channel } = preview;
  const epoch = usePreviewEpoch(preview);
  const [report, setReport] = useState<{
    epoch: PreviewEpoch;
    message: PreviewMessageOf<T>;
  } | null>(null);

  useEffect(
    () =>
      channel.on(type, (message) =>
        setReport({ epoch: channel.epoch(), message })
      ),
    [channel, type]
  );

  return report !== null && inScope(report.epoch, epoch, scope)
    ? report.message
    : null;
}

function inScope(
  reported: PreviewEpoch,
  current: PreviewEpoch,
  scope: ReportScope
): boolean {
  if (scope === "build") {
    return reported.build === current.build;
  }
  return reported.url === current.url && reported.video === current.video;
}

function hintOf(message: PreviewComposition | null): string | null {
  if (message === null) {
    return null;
  }

  if (message.compositionId === null) {
    return "This project registers no videos.";
  }

  // Naming the video the pane asked for is the whole point of this branch:
  // playing a neighbour instead would read as the wrong video rendering.
  if (message.reason === "missing") {
    return `Nothing in this project renders ${message.compositionId}. Ask the agent to register it, or open a video that is in the code.`;
  }

  if (message.unmeasured) {
    return `${message.compositionId} computes its metadata, which the preview cannot resolve yet.`;
  }

  if (message.reason === "folder") {
    return `Playing ${message.compositionId}, matched from the folder you opened.`;
  }

  if (message.reason === "first") {
    return `No video was asked for, so ${message.compositionId} is playing.`;
  }

  return null;
}
