import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { HistorySession, TranscriptEntry } from "@/shared/ipc";

export const listSessions: Effect.Effect<
  readonly HistorySession[],
  SidecarError
> = Effect.gen(function* () {
  const id = yield* newRequestId;

  return yield* requestSidecar({
    id,
    method: "history.sessions",
    params: null,
  });
});

export function loadTranscript(
  sessionId: string
): Effect.Effect<readonly TranscriptEntry[], SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "history.blocks",
      params: { sessionId },
    });
  });
}

export function removeSession(
  sessionId: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "history.remove",
      params: { sessionId },
    });

    return answer.removed;
  });
}
