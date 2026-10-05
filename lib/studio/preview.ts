import { Effect, Schema } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type * as Protocol from "@/preview/protocol";
import {
  CodeNodePath,
  CodePropStatus,
  type PreviewEvent,
  type PreviewParams,
  type PreviewResult,
  PromptElement,
  type StatusParams,
  type StatusResult,
  type Still,
  type StillEvent,
  type StillParams,
  VideoConfigValues,
  type Warmed,
  type WarmParams,
  type WriteParams,
  type WriteResult,
} from "@/shared/ipc";
import { StudioValue } from "@/shared/studio-document";

export type {
  CommandOf,
  CommandType,
  MessageType,
  TargetStatuses,
} from "@/preview/protocol";
export type PreviewCommand = Protocol.PreviewCommand;

export const PREVIEW_MESSAGE_SOURCE = "remocn-preview";

export const PreviewPick = Schema.Literals([
  "asked",
  "first",
  "folder",
  "main",
  "missing",
  "none",
]);

export const PreviewRect = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

export const PreviewWindow = Schema.Struct({
  from: Schema.Int,
  until: Schema.Int,
});

export const InspectStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
]);

export const SnapshotStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
]);

const from = Schema.Literal(PREVIEW_MESSAGE_SOURCE);

export const PLAYBACK_RATES = [0.25, 0.5, 1, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const Frame = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const PreviewScene = Schema.Struct({
  duration: Frame,
  from: Schema.Int,
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
});
export type PreviewScene = typeof PreviewScene.Type;

export const TuningValue = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.Union([Schema.Finite, Schema.String, Schema.Boolean, Schema.Null])
  ),
]);

export const TuningFieldType = Schema.Literals([
  "array",
  "asset",
  "boolean",
  "color",
  "enum",
  "font-family",
  "number",
  "rotation-css",
  "rotation-degrees",
  "scale",
  "text-content",
  "transform-origin",
  "translate",
  "uv-coordinate",
]);

export const TuningField = Schema.Struct({
  arrayItemType: Schema.NullOr(TuningFieldType),
  description: Schema.NullOr(Schema.String),
  group: Schema.String,
  label: Schema.String,
  max: Schema.NullOr(Schema.Finite),
  maxLength: Schema.NullOr(Schema.Int),
  min: Schema.NullOr(Schema.Finite),
  minLength: Schema.NullOr(Schema.Int),
  newItemDefault: Schema.NullOr(TuningValue),
  options: Schema.Array(Schema.String),
  path: Schema.NonEmptyString,
  readOnly: Schema.optionalKey(Schema.Boolean),
  step: Schema.NullOr(Schema.Finite),
  // A merged list is edited through as many targets as it was built from, so
  // the field says which `Interactive` in the chain owns it.
  targetId: Schema.NonEmptyString,
  type: TuningFieldType,
  value: TuningValue,
});

export const TuningWhere = Schema.Struct({
  column: Schema.NullOr(Schema.Int),
  file: Schema.NonEmptyString,
  line: Schema.NullOr(Schema.Int),
});

export const TuningTarget = Schema.Struct({
  componentName: Schema.NonEmptyString,
  fields: Schema.Array(TuningField),
  // Remotion's own identity for the component, and the flattened schema keys a
  // status is asked for. A page from an older build sends neither, and a target
  // with no keys is simply one nothing can be read for.
  identity: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  instanceId: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed(""))
  ),
  instances: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(1))),
  keys: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed([]))
  ),
  name: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  ordinal: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(1))),
  // The JSX call site, from Remotion's own stack — where a value is written.
  // `where` is a different fact and stays: it is the component's own file,
  // the pane's subtitle.
  origin: Schema.NullOr(TuningWhere).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  schema: Schema.optionalKey(Schema.Unknown),
  targetId: Schema.NonEmptyString,
  where: Schema.NullOr(TuningWhere).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
});

// The chain of `Interactive`s around the picked element, innermost first. A
// page from an older build sends nothing, and an empty chain is the same thing
// as the element having none.
const tuning = Schema.Array(TuningTarget).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

export const PreviewMetadata = Schema.Struct({
  durationInFrames: Schema.Int,
  fps: Schema.Finite,
  height: Schema.Int,
  width: Schema.Int,
});

export const PreviewMessage = Schema.Union([
  Schema.Struct({
    source: from,
    type: Schema.Literal("studio.geometry.request"),
  }),
  Schema.Struct({
    binding: Schema.Struct({
      height: Schema.NonEmptyString,
      rotation: Schema.NullOr(Schema.NonEmptyString),
      width: Schema.NonEmptyString,
      x: Schema.NonEmptyString,
      y: Schema.NonEmptyString,
    }),
    generation: Schema.NonEmptyString,
    objectId: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.geometry.begin"),
    values: Schema.Struct({
      height: Schema.Finite,
      rotation: Schema.Finite,
      width: Schema.Finite,
      x: Schema.Finite,
      y: Schema.Finite,
    }),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.geometry.commit"),
    values: Schema.Struct({
      height: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
      rotation: Schema.Finite,
      width: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
      x: Schema.Finite,
      y: Schema.Finite,
    }),
  }),
  Schema.Struct({
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.geometry.cancel"),
  }),
  Schema.Struct({
    candidates: Schema.Array(
      Schema.Struct({
        field: Schema.NullOr(Schema.NonEmptyString),
        text: Schema.String,
      })
    ).check(Schema.isMinLength(1), Schema.isMaxLength(16)),
    generation: Schema.NonEmptyString,
    objectId: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.text.request"),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.text.commit"),
    value: Schema.String,
  }),
  Schema.Struct({
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.text.cancel"),
  }),
  Schema.Struct({ source: from, type: Schema.Literal("inspect.ready") }),
  Schema.Struct({ source: from, type: Schema.Literal("inspect.clear") }),
  Schema.Struct({
    generation: Schema.NonEmptyString,
    lastOperationId: Schema.NullOr(Schema.NonEmptyString),
    source: from,
    type: Schema.Literal("studio.ready"),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    generation: Schema.NonEmptyString,
    objectId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("studio.select"),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    ids: Schema.Array(Schema.NonEmptyString),
    source: from,
    type: Schema.Literal("studio.present"),
  }),
  Schema.Struct({
    compositionId: Schema.NullOr(Schema.String),
    compositions: Schema.Array(Schema.NonEmptyString),
    // What the Player is really mounted with, calculateMetadata resolved. A
    // page from a build before this shipped sends none, and the pane then
    // knows only that the composition exists.
    metadata: Schema.NullOr(PreviewMetadata).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    reason: PreviewPick,
    source: from,
    total: Schema.Int,
    trouble: Schema.NullOr(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    type: Schema.Literal("composition"),
    unmeasured: Schema.Boolean,
  }),
  Schema.Struct({
    // Where the app can reach the project's static files, and which of them
    // are pictures. Page-level context, carried on the selection exactly as
    // the loaded font families are: only the page knows either.
    assetBase: Schema.NullOr(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    assets: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([]))
    ),
    element: PromptElement,
    fonts: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([]))
    ),
    rect: PreviewRect,
    repeat: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
    source: from,
    text: Schema.NullOr(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    tuning,
    type: Schema.Literal("selection"),
    // Only the page knows the composition's numbers, and the codemod needs
    // them to read a prop written as an expression over `fps` or `width`.
    video: Schema.NullOr(VideoConfigValues).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    window: Schema.NullOr(PreviewWindow).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
  }),
  Schema.Struct({
    frame: Schema.Int,
    playing: Schema.Boolean,
    source: from,
    type: Schema.Literal("playhead"),
  }),
  Schema.Struct({
    buffering: Schema.Boolean,
    compositionId: Schema.NonEmptyString,
    error: Schema.NullOr(Schema.String),
    muted: Schema.Boolean,
    source: from,
    type: Schema.Literal("transport.state"),
    volume: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  }),
  Schema.Struct({
    compositionId: Schema.NonEmptyString,
    scenes: Schema.Array(PreviewScene),
    source: from,
    type: Schema.Literal("scenes"),
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
  Schema.Struct({
    error: Schema.NullOr(Schema.String),
    ok: Schema.Boolean,
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("tune.result"),
  }),
  Schema.Struct({
    source: from,
    type: Schema.Literal("canvas.menu"),
  }),
]);

export const PreviewCommand = Schema.Union([
  Schema.Struct({
    enabled: Schema.Boolean,
    fields: Schema.Array(
      Schema.Struct({
        id: Schema.NonEmptyString,
        max: Schema.NullOr(Schema.Finite),
        min: Schema.NullOr(Schema.Finite),
        value: Schema.Finite,
      })
    ),
    generation: Schema.NonEmptyString,
    objectId: Schema.NullOr(Schema.NonEmptyString),
    type: Schema.Literal("studio.geometry.config"),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    error: Schema.NullOr(Schema.String),
    requestId: Schema.NonEmptyString,
    type: Schema.Literal("studio.geometry.result"),
  }),
  Schema.Struct({
    generation: Schema.NonEmptyString,
    objectId: Schema.NonEmptyString,
    type: Schema.Literal("studio.batch"),
    values: Schema.Record(Schema.NonEmptyString, StudioValue),
  }),
  Schema.Struct({
    candidate: Schema.Int,
    label: Schema.String,
    requestId: Schema.NonEmptyString,
    type: Schema.Literal("studio.text.open"),
    value: Schema.String,
  }),
  Schema.Struct({
    error: Schema.NullOr(Schema.String),
    requestId: Schema.NonEmptyString,
    type: Schema.Literal("studio.text.close"),
  }),
  Schema.Struct({ type: Schema.Literal("inspect.clear") }),
  Schema.Struct({ type: Schema.Literal("transport.request") }),
  Schema.Struct({ type: Schema.Literal("transport.toggle") }),
  Schema.Struct({
    direction: Schema.Literals([-1, 1]),
    type: Schema.Literal("transport.step"),
  }),
  Schema.Struct({
    muted: Schema.Boolean,
    type: Schema.Literal("transport.audio"),
    volume: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  }),
  Schema.Struct({
    rate: Schema.Literals(PLAYBACK_RATES),
    type: Schema.Literal("transport.rate"),
  }),
  Schema.Struct({ type: Schema.Literal("studio.request") }),
  Schema.Struct({
    field: Schema.NonEmptyString,
    generation: Schema.NonEmptyString,
    objectId: Schema.NonEmptyString,
    type: Schema.Literal("studio.draft"),
    value: StudioValue,
  }),
  Schema.Struct({
    generation: Schema.NonEmptyString,
    objectId: Schema.NullOr(Schema.NonEmptyString),
    type: Schema.Literal("studio.highlight"),
    video: Schema.NonEmptyString,
  }),
  Schema.Struct({
    objectId: Schema.NullOr(Schema.NonEmptyString),
    type: Schema.Literal("studio.hover"),
  }),
  Schema.Struct({
    selectors: Schema.Array(Schema.NonEmptyString),
    token: Schema.NonEmptyString,
    type: Schema.Literal("studio.hide"),
  }),
  Schema.Struct({
    token: Schema.NonEmptyString,
    type: Schema.Literal("studio.unhide"),
  }),
  Schema.Struct({
    armed: Schema.Boolean,
    type: Schema.Literal("inspect"),
  }),
  Schema.Struct({
    armed: Schema.Boolean,
    type: Schema.Literal("snapshot"),
  }),
  Schema.Struct({
    frame: Schema.Int,
    type: Schema.Literal("seek"),
  }),
  Schema.Struct({
    from: Schema.Int,
    type: Schema.Literal("replay"),
    until: Schema.Int,
  }),
  Schema.Struct({
    type: Schema.Literal("pause"),
  }),
  Schema.Struct({
    targets: Schema.Array(
      Schema.Struct({
        nodePath: Schema.NullOr(CodeNodePath),
        props: Schema.Record(Schema.String, CodePropStatus),
        targetId: Schema.NonEmptyString,
      })
    ),
    type: Schema.Literal("tuning.statuses"),
  }),
  Schema.Struct({
    // Whether anything is open to be highlighted *for*. `targetId: null` on its
    // own used to mean two different things — a card with no chain, which wants
    // the picked element boxed, and no card at all, which wants nothing drawn —
    // and the second read as the first, so Cancel moved the box back onto the
    // picked element and left it there.
    open: Schema.Boolean,
    targetId: Schema.NullOr(Schema.NonEmptyString),
    type: Schema.Literal("highlight"),
  }),
  Schema.Struct({
    path: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
    targetId: Schema.NonEmptyString,
    type: Schema.Literal("tune.set"),
    value: TuningValue,
  }),
  Schema.Struct({
    paths: Schema.Array(Schema.NonEmptyString),
    requestId: Schema.NonEmptyString,
    targetId: Schema.NonEmptyString,
    type: Schema.Literal("tune.reset"),
  }),
]);

export type InspectStatus = (typeof InspectStatus)["Type"];
export type SnapshotStatus = (typeof SnapshotStatus)["Type"];
export type PreviewRect = (typeof PreviewRect)["Type"];
export type PreviewMessage = (typeof PreviewMessage)["Type"];
export type PreviewInspect = Extract<PreviewMessage, { type: "inspect" }>;
export type PreviewSnapshot = Extract<PreviewMessage, { type: "snapshot" }>;
export type PreviewCapture = Extract<PreviewMessage, { type: "capture" }>;
export type PreviewTuneResult = Extract<
  PreviewMessage,
  { type: "tune.result" }
>;
export type PreviewComposition = Extract<
  PreviewMessage,
  { type: "composition" }
>;
export type PreviewMetadata = (typeof PreviewMetadata)["Type"];
export type PreviewSelection = Extract<PreviewMessage, { type: "selection" }>;
export type PreviewPlayhead = Extract<PreviewMessage, { type: "playhead" }>;
export type PreviewWindow = (typeof PreviewWindow)["Type"];
export type TuningField = (typeof TuningField)["Type"];
export type TuningTarget = (typeof TuningTarget)["Type"];
export type TuningWhere = (typeof TuningWhere)["Type"];
export type TuningValue = (typeof TuningValue)["Type"];
export type TuningStatuses = Protocol.TargetStatuses;
export type PreviewMessageOf<T extends Protocol.MessageType> = Extract<
  PreviewMessage,
  { type: T }
>;

type Bare<T> = T extends unknown ? Omit<T, "source"> : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Shape<T> = T extends readonly (infer E)[]
  ? Shape<E>[]
  : T extends object
    ? {
        -readonly [K in keyof T]-?: [
          Shape<Exclude<T[K], undefined>>,
          Pick<T, K> extends Required<Pick<T, K>> ? "required" : "optional",
        ];
      }
    : T;
type Agree<S extends { type: string }, P extends { type: string }> = {
  [K in S["type"] | P["type"]]: Same<
    Shape<Bare<Extract<S, { type: K }>>>,
    Shape<Extract<P, { type: K }>>
  >;
};
type Assert<T extends true> = T;
type SchemaCommand = (typeof PreviewCommand)["Type"];

export type EveryMessageAgrees = Assert<
  Same<PreviewMessage["type"], Protocol.MessageType>
>;
export type EveryCommandAgrees = Assert<
  Same<SchemaCommand["type"], Protocol.CommandType>
>;
export const messagesAgree: { [K in Protocol.MessageType]: true } =
  null as unknown as Agree<PreviewMessage, Protocol.PreviewMessage>;
export const commandsAgree: { [K in Protocol.CommandType]: true } =
  null as unknown as Agree<SchemaCommand, Protocol.PreviewCommand>;

export const decodePreviewMessage = Schema.decodeUnknownExit(PreviewMessage);
export const decodePreviewCommand = Schema.decodeUnknownExit(PreviewCommand);

export function inspectCommand(armed: boolean): PreviewCommand {
  return { armed, type: "inspect" };
}

export function snapshotCommand(armed: boolean): PreviewCommand {
  return { armed, type: "snapshot" };
}

/** Point at one `Interactive` of the open selection, or at none. */
export function highlightCommand(
  targetId: string | null,
  open: boolean
): PreviewCommand {
  return { open, targetId, type: "highlight" };
}

export function hideCommand(
  token: string,
  selectors: readonly string[]
): PreviewCommand {
  return { selectors, token, type: "studio.hide" };
}

export function unhideCommand(token: string): PreviewCommand {
  return { token, type: "studio.unhide" };
}

export function managedSelector(objectId: string): string {
  return `[data-studio-object="${objectId}"]`;
}

export function seekCommand(frame: number): PreviewCommand {
  return { frame, type: "seek" };
}

export function replayCommand(span: PreviewWindow): PreviewCommand {
  return { from: span.from, type: "replay", until: span.until };
}

export function pauseCommand(): PreviewCommand {
  return { type: "pause" };
}

export function tuningStatusesCommand(
  targets: readonly TuningStatuses[]
): PreviewCommand {
  return { targets: [...targets], type: "tuning.statuses" };
}

export function tuneSetCommand(
  requestId: string,
  targetId: string,
  path: string,
  value: TuningValue
): PreviewCommand {
  return { path, requestId, targetId, type: "tune.set", value };
}

export function tuneResetCommand(
  requestId: string,
  targetId: string,
  paths: readonly string[]
): PreviewCommand {
  return { paths: [...paths], requestId, targetId, type: "tune.reset" };
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

export function readCodeStatuses(
  params: StatusParams
): Effect.Effect<StatusResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.status", params }).pipe(
      Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
    );
  });
}

export function writeCode(
  params: WriteParams
): Effect.Effect<WriteResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.write", params }).pipe(
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
