import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { ExportEvent, Exported, ExportParams } from "@/shared/ipc";

const KB = 1024;

export function renderExport(
  params: ExportParams,
  onEvent: (event: ExportEvent) => void
): Effect.Effect<Exported, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "preview.export",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function exportStatus(event: ExportEvent | null): string | null {
  if (event === null) {
    return "Starting the render…";
  }

  if (event.type === "browser") {
    return `Downloading the renderer's browser — ${event.percent}%`;
  }

  if (event.total === 0) {
    return "Measuring the composition…";
  }

  if (event.rendered < event.total) {
    return `Rendering — ${event.rendered}/${event.total} frames · ${event.percent}%`;
  }

  if (event.encoded < event.total) {
    return `Encoding — ${event.encoded}/${event.total} frames · ${event.percent}%`;
  }

  return event.stage === "muxing"
    ? "Combining the audio and the video…"
    : "Finishing the file…";
}

export function exportPercent(event: ExportEvent | null): number | null {
  return event === null ? null : event.percent;
}

export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const kb = bytes / KB;

  return kb < KB
    ? `${Math.max(1, Math.round(kb))} KB`
    : `${(kb / KB).toFixed(1)} MB`;
}

export function exportLabel(exported: Exported, root: string | null): string {
  return `${withinProject(exported.path, root)} · ${fileSize(exported.bytes)}`;
}

function withinProject(target: string, root: string | null): string {
  if (root === null) {
    return target;
  }

  const prefix = root.endsWith("/") ? root : `${root}/`;

  return target.startsWith(prefix) ? target.slice(prefix.length) : target;
}
