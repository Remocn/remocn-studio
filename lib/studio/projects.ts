import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { Project, ProjectDraft, ScaffoldEvent } from "@/shared/ipc";

export const listProjects: Effect.Effect<readonly Project[], SidecarError> =
  Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "project.list", params: null });
  });

export function openProject(
  path: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.open",
      params: { path },
    });
  });
}

export function createProject(
  params: ProjectDraft
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "project.create", params });
  });
}

export function renameProject(
  projectId: string,
  name: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.rename",
      params: { name, projectId },
    });
  });
}

export function scaffoldProject(
  projectId: string,
  onEvent: (event: ScaffoldEvent) => void
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.scaffold",
      onStream: onEvent,
      params: { projectId },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function relocateProject(
  projectId: string,
  path: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.relocate",
      params: { path, projectId },
    });
  });
}

export function removeProject(
  projectId: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "project.remove",
      params: { projectId },
    });

    return answer.removed;
  });
}
