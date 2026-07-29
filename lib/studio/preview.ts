import { Effect, Schema } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import {
  type PreviewEvent,
  type PreviewParams,
  type PreviewResult,
  PromptElement,
  type Still,
  type StillEvent,
  type StillParams,
  type Warmed,
  type WarmParams,
} from "@/shared/ipc";

export const PREVIEW_MESSAGE_SOURCE = "remocn-preview";
export const PREVIEW_COMMAND_SOURCE = "remocn-studio";

export const PreviewPick = Schema.Literals(["first", "folder", "main", "none"]);

export const PreviewRect = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

export const InspectStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
  "no-grab",
]);

export const SnapshotStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
]);

const from = Schema.Literal(PREVIEW_MESSAGE_SOURCE);

export const PreviewMessage = Schema.Union([
  Schema.Struct({
    compositionId: Schema.NullOr(Schema.String),
    reason: PreviewPick,
    source: from,
    total: Schema.Int,
    type: Schema.Literal("composition"),
    unmeasured: Schema.Boolean,
  }),
  Schema.Struct({
    element: PromptElement,
    rect: PreviewRect,
    source: from,
    type: Schema.Literal("selection"),
  }),
  Schema.Struct({
    paused: Schema.Boolean,
    source: from,
    status: InspectStatus,
    type: Schema.Literal("inspect"),
  }),
  Schema.Struct({
    paused: Schema.Boolean,
    source: from,
    status: SnapshotStatus,
    type: Schema.Literal("snapshot"),
  }),
  Schema.Struct({
    composition: Schema.NonEmptyString,
    frame: Schema.Int,
    rect: Schema.NullOr(PreviewRect),
    source: from,
    type: Schema.Literal("capture"),
  }),
  Schema.Struct({
    source: from,
    type: Schema.Literal("rebuilt"),
  }),
]);

const to = Schema.Literal(PREVIEW_COMMAND_SOURCE);

export const PreviewCommand = Schema.Union([
  Schema.Struct({
    armed: Schema.Boolean,
    source: to,
    type: Schema.Literal("inspect"),
  }),
  Schema.Struct({
    armed: Schema.Boolean,
    source: to,
    type: Schema.Literal("snapshot"),
  }),
  Schema.Struct({
    frozen: Schema.Boolean,
    source: to,
    type: Schema.Literal("freeze"),
  }),
  Schema.Struct({
    frame: Schema.Int,
    source: to,
    type: Schema.Literal("seek"),
  }),
]);

export type InspectStatus = (typeof InspectStatus)["Type"];
export type SnapshotStatus = (typeof SnapshotStatus)["Type"];
export type PreviewRect = (typeof PreviewRect)["Type"];
export type PreviewMessage = (typeof PreviewMessage)["Type"];
export type PreviewInspect = Extract<PreviewMessage, { type: "inspect" }>;
export type PreviewSnapshot = Extract<PreviewMessage, { type: "snapshot" }>;
export type PreviewCapture = Extract<PreviewMessage, { type: "capture" }>;
export type PreviewCommand = (typeof PreviewCommand)["Type"];
export type PreviewComposition = Extract<
  PreviewMessage,
  { type: "composition" }
>;
export type PreviewSelection = Extract<PreviewMessage, { type: "selection" }>;

export const decodePreviewMessage = Schema.decodeUnknownExit(PreviewMessage);
export const decodePreviewCommand = Schema.decodeUnknownExit(PreviewCommand);

export function inspectCommand(armed: boolean): PreviewCommand {
  return { armed, source: PREVIEW_COMMAND_SOURCE, type: "inspect" };
}

export function snapshotCommand(armed: boolean): PreviewCommand {
  return { armed, source: PREVIEW_COMMAND_SOURCE, type: "snapshot" };
}

export function freezeCommand(frozen: boolean): PreviewCommand {
  return { frozen, source: PREVIEW_COMMAND_SOURCE, type: "freeze" };
}

export function seekCommand(frame: number): PreviewCommand {
  return { frame, source: PREVIEW_COMMAND_SOURCE, type: "seek" };
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

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

export function warmComposition(
  params: WarmParams
): Effect.Effect<Warmed, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.warm", params }).pipe(
      Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
    );
  });
}

export function renderStill(
  params: StillParams,
  onEvent: (event: StillEvent) => void
): Effect.Effect<Still, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "preview.still",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}
