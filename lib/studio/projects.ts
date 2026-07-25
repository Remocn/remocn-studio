import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { Project, ProjectDraft } from "@/shared/ipc";

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
