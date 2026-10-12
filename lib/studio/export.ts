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

const STAGE_LABELS: Record<string, string> = {
  finalizing: "Writing the file…",
  preparing: "Taking a copy of the compiled project…",
  rendering: "Measuring the video…",
};

const STAGE_BRIEFS: Record<string, string> = {
  finalizing: "Writing…",
  preparing: "Preparing…",
  rendering: "Measuring…",
};

export function exportStatus(event: ExportEvent | null): string | null {
  if (event === null) {
    return "Starting the render…";
  }

  if (event.type === "browser") {
    return `Downloading the renderer’s browser — ${event.percent}%`;
  }

  if (event.type === "stage") {
    return STAGE_LABELS[event.stage] ?? "Working…";
  }

  if (event.type === "notice") {
    return null;
  }

  if (event.total === 0) {
    return "Measuring the video…";
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

export interface ExportBrief {
  label: string;
  percent: number | null;
}

export function exportBrief(event: ExportEvent | null): ExportBrief {
  if (event === null) {
    return { label: "Starting…", percent: null };
  }

  if (event.type === "browser") {
    return { label: `Downloading · ${event.percent}%`, percent: event.percent };
  }

  if (event.type === "stage") {
    return { label: STAGE_BRIEFS[event.stage] ?? "Working…", percent: null };
  }

  if (event.type === "notice") {
    return { label: "Rendering…", percent: null };
  }

  if (event.total === 0) {
    return { label: "Measuring…", percent: null };
  }

  if (event.rendered < event.total) {
    return { label: `Rendering · ${event.percent}%`, percent: event.percent };
  }

  if (event.encoded < event.total) {
    return { label: `Encoding · ${event.percent}%`, percent: event.percent };
  }

  return event.stage === "muxing"
    ? { label: "Combining…", percent: null }
    : { label: "Finishing…", percent: null };
}

export function exportPercent(event: ExportEvent | null): number | null {
  if (event === null || event.type === "stage" || event.type === "notice") {
    return null;
  }

  return event.percent;
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
  const size =
    exported.width > 0 && exported.height > 0
      ? `${exported.width}×${exported.height} · `
      : "";

  return `${withinProject(exported.path, root)} · ${size}${fileSize(exported.bytes)}`;
}

function withinProject(target: string, root: string | null): string {
  if (root === null) {
    return target;
  }

  const prefix = root.endsWith("/") ? root : `${root}/`;

  return target.startsWith(prefix) ? target.slice(prefix.length) : target;
}

export interface PendingEdit {
  readonly tuning: {
    readonly originals: Readonly<
      Record<string, Readonly<Record<string, unknown>>>
    >;
  } | null;
  readonly writes: readonly unknown[];
}

// An element chip carries values that are live in the preview and not yet in
// the code — either edits the studio will write at Send, or a request the
// agent will answer. Either way an export now renders the file as it stands,
// which is not what is on screen.
export function pendingEdits(selections: readonly PendingEdit[]): number {
  return selections.filter(
    (selection) =>
      selection.writes.length > 0 ||
      Object.values(selection.tuning?.originals ?? {}).some(
        (paths) => Object.keys(paths).length > 0
      )
  ).length;
}

export function defaultPathIn(folder: string, fileName: string): string {
  return folder.endsWith("/")
    ? `${folder}${fileName}`
    : `${folder}/${fileName}`;
}

const HOME = /^\/(?:Users|home)\/[^/]+/;

const TRAILING_SLASH = /\/$/;

/**
 * A destination the person can read at a glance: inside the project it is the
 * relative folder they already think in, and outside it the home directory
 * collapses to `~` so the interesting end of the path survives truncation.
 */
export function folderLabel(
  folder: string | null,
  root: string | null
): string {
  if (folder === null) {
    return "out";
  }

  const inside = root === null ? null : root.replace(TRAILING_SLASH, "");

  if (inside !== null && folder === inside) {
    return "the project folder";
  }

  if (inside !== null && folder.startsWith(`${inside}/`)) {
    return folder.slice(inside.length + 1);
  }

  return folder.replace(HOME, "~");
}

export function targetPath(input: {
  readonly fileName: string;
  readonly folder: string | null;
  readonly root: string | null;
}): string {
  if (input.folder !== null) {
    return defaultPathIn(input.folder, input.fileName);
  }

  return input.root === null
    ? `out/${input.fileName}`
    : defaultPathIn(
        `${input.root.replace(TRAILING_SLASH, "")}/out`,
        input.fileName
      );
}
