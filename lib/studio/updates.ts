import { invoke } from "@tauri-apps/api/core";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { decodeStudioBuild, type StudioBuild } from "@/shared/ipc";

export class UpdateError extends Data.TaggedError("UpdateError")<{
  message: string;
}> {}

export interface Download {
  received: number;
  total: number | null;
}

export interface Release {
  body: string | null;
  date: string | null;
  version: string;
}

export const NOTHING_DOWNLOADED: Download = { received: 0, total: null };

const fail = (cause: unknown) =>
  new UpdateError({ message: errorMessage(cause) });

export const fetchStudioBuild: Effect.Effect<StudioBuild, UpdateError> =
  Effect.tryPromise({
    catch: fail,
    try: () => invoke<unknown>("studio_build"),
  }).pipe(Effect.flatMap(decodeStudioBuild), Effect.mapError(fail));

export const checkForUpdate: Effect.Effect<Update | null, UpdateError> =
  Effect.tryPromise({
    catch: fail,
    try: () => check(),
  });

export function installUpdate(
  update: Update,
  onEvent: (event: DownloadEvent) => void
): Effect.Effect<void, UpdateError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => update.downloadAndInstall(onEvent),
  });
}

export const restartStudio: Effect.Effect<void, UpdateError> =
  Effect.tryPromise({
    catch: fail,
    try: () => invoke<void>("restart_studio"),
  });

export function releaseOf(update: Update): Release {
  return {
    body: update.body ?? null,
    date: update.date ?? null,
    version: update.version,
  };
}

export function advance(download: Download, event: DownloadEvent): Download {
  if (event.event === "Started") {
    return { received: 0, total: event.data.contentLength ?? null };
  }

  if (event.event === "Progress") {
    return {
      received: download.received + event.data.chunkLength,
      total: download.total,
    };
  }

  return download.total === null
    ? download
    : { received: download.total, total: download.total };
}

export function downloadedShare(download: Download): number | null {
  if (download.total === null || download.total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((download.received / download.total) * 100));
}

export function downloadedLabel(download: Download): string {
  const share = downloadedShare(download);
  return share === null
    ? `Downloading — ${megabytes(download.received)}`
    : `Downloading — ${share}%`;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
