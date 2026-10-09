import { Effect } from "effect";
import type { SidecarParams } from "@/shared/ipc";
import type { ShaderProgress } from "@/shared/shaders";
import { cancelSidecarRequest, newRequestId, requestSidecar } from "./sidecar";

export const listShaders = Effect.gen(function* () {
  const id = yield* newRequestId;
  return yield* requestSidecar({ id, method: "shader.list", params: null });
});

export function shaderTargets(params: SidecarParams<"shader.targets">) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "shader.targets", params });
  });
}

export function insertShader(
  params: SidecarParams<"shader.insert">,
  onStream: (progress: ShaderProgress) => void
) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({
      id,
      method: "shader.insert",
      onStream,
      params,
    }).pipe(
      Effect.onInterrupt(() => cancelSidecarRequest(id).pipe(Effect.ignore))
    );
  });
}

export function shaderInsertionStatus(
  params: SidecarParams<"shader.insertionStatus">
) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({
      id,
      method: "shader.insertionStatus",
      params,
    });
  });
}
