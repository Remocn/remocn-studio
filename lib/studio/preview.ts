import { Effect, Schema } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { PreviewEvent, PreviewParams, PreviewResult } from "@/shared/ipc";

export const PREVIEW_MESSAGE_SOURCE = "remocn-preview";

export const PreviewMessage = Schema.Struct({
  compositionId: Schema.NullOr(Schema.String),
  isFallback: Schema.Boolean,
  source: Schema.Literal(PREVIEW_MESSAGE_SOURCE),
  total: Schema.Int,
  unmeasured: Schema.Boolean,
});

export type PreviewMessage = (typeof PreviewMessage)["Type"];

export const decodePreviewMessage = Schema.decodeUnknownExit(PreviewMessage);

export function startPreview(
  params: PreviewParams,
  onEvent: (event: PreviewEvent) => void
): Effect.Effect<PreviewResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "preview.start",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}
