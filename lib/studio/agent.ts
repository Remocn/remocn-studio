import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  AgentEvent,
  EnvironmentCheck,
  PermissionAnswer,
  PermissionParams,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";

export function promptAgent(
  params: PromptParams,
  onEvent: (event: AgentEvent) => void
): Effect.Effect<PromptResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "agent.prompt",
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

    return yield* requestSidecar({ id, method: "agent.permission", params });
  });
}

export function providerAccounts(): Effect.Effect<
  readonly EnvironmentCheck[],
  SidecarError
> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "agent.accounts",
      params: null,
    });
  });
}
