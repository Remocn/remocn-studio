import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  ClaudeEvent,
  PermissionAnswer,
  PermissionParams,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";

export function promptClaude(
  params: PromptParams,
  onEvent: (event: ClaudeEvent) => void
): Effect.Effect<PromptResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "claude.prompt",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function answerPermission(
  params: PermissionParams
): Effect.Effect<PermissionAnswer, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "claude.permission", params });
  });
}
