import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { DirectoryListing, ProjectFiles } from "@/shared/ipc";

export function listProjectFiles(
  projectId: string
): Effect.Effect<ProjectFiles, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.files",
      params: { projectId },
    });
  });
}

export function listFolder(
  path: string
): Effect.Effect<DirectoryListing, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "files.list",
      params: { path },
    });
  });
}
