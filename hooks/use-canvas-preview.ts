"use client";

import { useMemo } from "react";
import type { NativePreviewState } from "@/lib/studio/native-preview";
import { inspectorHasRoom } from "@/lib/studio/panes";
import type { PreviewComposition } from "@/lib/studio/preview";
import type { StudioSettings } from "@/lib/studio/settings";
import { useCanvasLayers } from "./use-canvas-layers";
import { useCanvasRulers } from "./use-canvas-rulers";
import { useNativePreview } from "./use-native-preview";
import { usePresence } from "./use-presence";
import type { Preview, PreviewControl } from "./use-preview";
import {
  type PreviewCameraControl,
  useCameraView,
  usePreviewCamera,
} from "./use-preview-camera";
import { usePreviewTransport } from "./use-preview-transport";
import { usePreviewViewing } from "./use-preview-viewing";
import type { Tools } from "./use-tools";

interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

type Metadata = NonNullable<PreviewComposition["metadata"]>;

function failureOf(served: Preview, state: NativePreviewState): string | null {
  if (served.phase === "failed") {
    return served.message;
  }
  if (served.phase === "ready" && state.phase === "failed") {
    return state.message;
  }
  return null;
}

function noticeOf(
  projectId: string | null,
  preview: PreviewControl,
  state: NativePreviewState,
  metadata: Metadata | null
): string | null {
  if (projectId === null) {
    return "Open a project to preview your video.";
  }
  const served = preview.preview;
  if (served.phase === "building") {
    return served.percent > 0
      ? `Building the project — ${served.percent}%`
      : "Starting the compiler…";
  }
  if (served.phase !== "ready") {
    return "Preparing the project…";
  }
  if (state.phase === "loading") {
    return "Preparing the canvas…";
  }
  if (preview.hint !== null) {
    return preview.hint;
  }
  return metadata === null ? "Loading the video…" : null;
}

function selectionOf(
  managed: Tools["managed"],
  card: Tools["inspect"]["card"]
): unknown {
  if (managed?.isOpen) {
    return `object:${managed.selected?.id ?? ""}`;
  }
  return card?.tuning ? card.element : null;
}

export function useCanvasPreview({
  hidden,
  isLeftmost = false,
  projectId,
  settings,
  tools,
}: {
  hidden: boolean;
  isLeftmost?: boolean;
  projectId: string | null;
  settings: StudioSettings | null;
  tools: Tools;
}) {
  const { inspect, managed, preview } = tools;
  const metadata = preview.pick?.metadata ?? null;
  const transport = usePreviewTransport(preview, !hidden);
  const viewing = usePreviewViewing({
    enabled: !hidden,
    playing: transport.playing,
    ready: transport.ready,
    surface: transport.surface,
    toggle: transport.toggle,
  });
  const camera = usePreviewCamera(
    metadata,
    projectId === null ? null : `${projectId}:${preview.composition}`,
    transport.toggle,
    viewing.viewing
  );
  const selection = selectionOf(managed, inspect.card);
  const { width } = camera.bounds;
  const layers = useCanvasLayers({
    deletion: tools.deletion,
    hasRoom: width === 0 || inspectorHasRoom(width, isLeftmost),
    managed,
    preview,
    scenes: transport.scenes,
    seekTo: transport.seekTo,
    selection,
    viewport: camera.viewport,
  });
  const pointed = inspect.card === null ? null : inspect.card.rect;
  const rulers = useCanvasRulers({
    camera: camera.view,
    selection: pointed ?? managed?.selected ?? selection,
    settings,
    video: metadata,
    viewport: camera.viewport,
  });
  const native = useNativePreview(
    preview,
    camera.viewport,
    managed?.acceptsPreview
  );
  const failure = failureOf(preview.preview, native.state);
  const notice = noticeOf(projectId, preview, native.state, metadata);
  const card = usePresence(failure ?? notice);
  const served = preview.preview;
  const building = served.phase === "building";
  const percent =
    served.phase === "building" && served.percent > 0 ? served.percent : null;
  const stale = native.state.phase === "ready" ? native.state.stale : null;

  return {
    building,
    camera,
    card,
    failure,
    hasSelection: selection !== null,
    layers,
    metadata,
    native,
    notice,
    percent,
    rulers,
    stale,
    transport,
    viewing,
  };
}

export function useCanvasOverlay(
  camera: PreviewCameraControl,
  inspect: Tools["inspect"],
  metadata: Metadata | null
) {
  const { bounds } = camera;
  const view = useCameraView(camera).camera;

  return useMemo(() => {
    const scaleX = ((metadata?.width ?? 0) * view.zoom) / (bounds.width || 1);
    const scaleY = ((metadata?.height ?? 0) * view.zoom) / (bounds.height || 1);
    const onCanvas = (rect: Rect): Rect => ({
      height: rect.height * scaleY,
      width: rect.width * scaleX,
      x: view.x / (bounds.width || 1) + rect.x * scaleX,
      y: view.y / (bounds.height || 1) + rect.y * scaleY,
    });
    return {
      card:
        inspect.card === null
          ? null
          : { ...inspect.card, rect: onCanvas(inspect.card.rect) },
      markers: inspect.markers.map((marker) => ({
        ...marker,
        rect: onCanvas(marker.rect),
      })),
    };
  }, [bounds, inspect.card, inspect.markers, metadata, view]);
}
