import { useEffect, useState } from "react";
import { Internals } from "remotion";
import type { MessageOf } from "./protocol";

const MAIN_ID = "Main";

export interface ResolvedMetadata {
  component: React.FC;
  defaultProps: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  height: number;
  props: Record<string, unknown>;
  width: number;
}

interface Resolution {
  message: string | null;
  metadata: ResolvedMetadata | null;
  state: "failed" | "loading" | "ready";
}

const LOADING: Resolution = { message: null, metadata: null, state: "loading" };

export function useResolvedMetadata(
  composition: AnyComposition | null
): Resolution {
  const [resolution, setResolution] = useState<Resolution>(LOADING);

  useEffect(() => {
    if (composition === undefined || composition === null) {
      setResolution(LOADING);
      return;
    }

    const still = staticOf(composition);

    if (typeof composition.calculateMetadata !== "function") {
      setResolution(
        still === null
          ? {
              message: `${composition.id} declares no size, and it has no calculateMetadata to give one`,
              metadata: null,
              state: "failed",
            }
          : { message: null, metadata: still, state: "ready" }
      );
      return;
    }

    const controller = new AbortController();
    let live = true;

    setResolution(LOADING);

    askForMetadata(composition, controller.signal)
      .then((video) => {
        if (!live) {
          return;
        }
        setResolution({
          message: null,
          metadata: {
            component: composition.component as unknown as React.FC,
            defaultProps: video.defaultProps ?? {},
            durationInFrames: video.durationInFrames,
            fps: video.fps,
            height: video.height,
            props: video.props ?? {},
            width: video.width,
          },
          state: "ready",
        });
      })
      .catch((cause: unknown) => {
        if (!live) {
          return;
        }
        setResolution({
          message: messageOf(cause),
          metadata: null,
          state: "failed",
        });
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [composition]);

  return resolution;
}

interface VideoConfigLike {
  defaultProps?: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  height: number;
  props?: Record<string, unknown>;
  width: number;
}

async function askForMetadata(
  composition: AnyComposition,
  signal: AbortSignal
): Promise<VideoConfigLike> {
  const resolve = (
    Internals as unknown as {
      resolveVideoConfig?: (input: Record<string, unknown>) => unknown;
    }
  ).resolveVideoConfig;

  if (typeof resolve !== "function") {
    const still = staticOf(composition);

    if (still === null) {
      throw new Error(
        "this Remotion cannot resolve calculateMetadata outside its own Studio"
      );
    }

    return still;
  }

  return (await resolve({
    calculateMetadata: composition.calculateMetadata ?? null,
    compositionDurationInFrames: composition.durationInFrames ?? null,
    compositionFps: composition.fps ?? null,
    compositionHeight: composition.height ?? null,
    compositionId: composition.id,
    compositionWidth: composition.width ?? null,
    defaultProps: composition.defaultProps ?? {},
    inputProps: {},
    signal,
  })) as VideoConfigLike;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function staticOf(composition: AnyComposition): ResolvedMetadata | null {
  const { durationInFrames, fps, height, width } = composition;

  if (
    durationInFrames === undefined ||
    fps === undefined ||
    height === undefined ||
    width === undefined
  ) {
    return null;
  }

  return {
    component: composition.component as unknown as React.FC,
    defaultProps: composition.defaultProps ?? {},
    durationInFrames,
    fps,
    height,
    props: composition.defaultProps ?? {},
    width,
  };
}

export function describe(
  picked: ReturnType<typeof pick>,
  resolved: Resolution,
  compositions: readonly string[]
): MessageOf<"composition"> {
  const total = compositions.length;

  if (picked === null) {
    return {
      compositionId: null,
      compositions,
      metadata: null,
      reason: "none",
      total,
      trouble: null,
      type: "composition",
      unmeasured: false,
    };
  }

  const { metadata } = resolved;

  return {
    // A missing video keeps its id in the message: the pane has to be able to
    // name what it asked for, and "unmeasured" is a different fact — a
    // composition that exists but computes its metadata.
    compositionId: picked.id,
    compositions,
    // The numbers the Player is really mounted with, calculateMetadata
    // resolved. The export measures the same composition in its own browser,
    // so this is what the dialog can promise a size from.
    metadata:
      metadata === null
        ? null
        : {
            durationInFrames: metadata.durationInFrames,
            fps: metadata.fps,
            height: metadata.height,
            width: metadata.width,
          },
    reason: picked.reason,
    total,
    trouble: resolved.state === "failed" ? resolved.message : null,
    type: "composition",
    unmeasured: picked.reason !== "missing" && metadata === null,
  };
}

interface AnyComposition {
  calculateMetadata?: ((input: never) => unknown) | null;
  component: unknown;
  defaultProps?: Record<string, unknown>;
  durationInFrames: number | undefined;
  fps: number | undefined;
  height: number | undefined;
  id: string;
  width: number | undefined;
}

export function pick(
  compositions: AnyComposition[],
  asked: string | null,
  preferred: string | null
) {
  if (compositions.length === 0) {
    return null;
  }

  if (asked !== null) {
    const byId = compositions.find((composition) => composition.id === asked);

    // Playing the neighbour instead is the one thing this must not do: the
    // pane asked for a video by name, and a silent substitution reads as the
    // wrong video rendering rather than as a video nothing registers.
    return byId === undefined
      ? { composition: null, id: asked, reason: "missing" as const }
      : { composition: byId, id: byId.id, reason: "asked" as const };
  }

  const byFolder =
    preferred === null
      ? undefined
      : compositions.find((composition) => composition.id === preferred);

  if (byFolder !== undefined) {
    return {
      composition: byFolder,
      id: byFolder.id,
      reason: "folder" as const,
    };
  }

  const main = compositions.find((composition) => composition.id === MAIN_ID);

  if (main !== undefined) {
    return { composition: main, id: main.id, reason: "main" as const };
  }

  const [first] = compositions;

  return { composition: first, id: first.id, reason: "first" as const };
}
