import { type Exit, Schema, type SchemaError } from "effect";

export const SIDECAR_PROTOCOL = 3;

export const SIDECAR_STATUS_EVENT = "sidecar://status";
export const SIDECAR_NOTIFY_EVENT = "sidecar://notify";

export const HOST_PID_ENV = "REMOCN_STUDIO_HOST_PID";

export const CANCELLED = "cancelled";

const RequestId = Schema.NonEmptyString;

export const METHOD_NAMES = [
  "claude.prompt",
  "sidecar.emit",
  "sidecar.info",
] as const;

export const SidecarInfo = Schema.Struct({
  bun: Schema.String,
  cwd: Schema.String,
  pid: Schema.Int,
  protocol: Schema.Int,
  uptimeMs: Schema.Int,
});

export const EmitParams = Schema.Struct({
  count: Schema.Finite,
  delayMs: Schema.Finite,
});

export const EmitChunk = Schema.Struct({
  index: Schema.Int,
  token: Schema.String,
  total: Schema.Int,
});

export const EmitResult = Schema.Struct({
  elapsedMs: Schema.Int,
  emitted: Schema.Int,
});

export type SidecarInfo = (typeof SidecarInfo)["Type"];
export type EmitParams = (typeof EmitParams)["Type"];
export type EmitChunk = (typeof EmitChunk)["Type"];
export type EmitResult = (typeof EmitResult)["Type"];

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

export const EffortLevel = Schema.Literals(EFFORT_LEVELS);

export function isEffortLevel(value: unknown): value is EffortLevel {
  return (
    typeof value === "string" &&
    (EFFORT_LEVELS as readonly string[]).includes(value)
  );
}

export const ImageMediaType = Schema.Literals([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const PromptAttachment = Schema.Struct({
  mediaType: ImageMediaType,
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
});

export const PromptParams = Schema.Struct({
  attachments: Schema.Array(PromptAttachment),
  cwd: Schema.NonEmptyString,
  effort: Schema.NullOr(EffortLevel),
  model: Schema.NullOr(Schema.NonEmptyString),
  prompt: Schema.String,
  sessionId: Schema.NullOr(Schema.NonEmptyString),
});

export const ContextUsage = Schema.Struct({
  maxTokens: Schema.Int,
  totalTokens: Schema.Int,
});

export const ClaudeFailureKind = Schema.Literals([
  "auth",
  "usage",
  "model",
  "unknown",
]);

export const ClaudeFailure = Schema.Struct({
  kind: ClaudeFailureKind,
  message: Schema.String,
});

export const ClaudeEvent = Schema.Union([
  Schema.Struct({
    model: Schema.String,
    sessionId: Schema.String,
    type: Schema.Literal("session"),
  }),
  Schema.Struct({
    text: Schema.String,
    type: Schema.Literal("text"),
  }),
  Schema.Struct({
    text: Schema.String,
    type: Schema.Literal("thinking"),
  }),
  Schema.Struct({
    id: Schema.String,
    input: Schema.Unknown,
    name: Schema.String,
    type: Schema.Literal("tool_use"),
  }),
  Schema.Struct({
    id: Schema.String,
    isError: Schema.Boolean,
    text: Schema.String,
    type: Schema.Literal("tool_result"),
  }),
  Schema.Struct({
    message: Schema.String,
    type: Schema.Literal("notice"),
  }),
]);

export const PromptResult = Schema.Struct({
  context: Schema.NullOr(ContextUsage),
  failure: Schema.NullOr(ClaudeFailure),
  sessionId: Schema.NullOr(Schema.String),
});

export type PromptParams = (typeof PromptParams)["Type"];
export type EffortLevel = (typeof EffortLevel)["Type"];
export type ImageMediaType = (typeof ImageMediaType)["Type"];
export type PromptAttachment = (typeof PromptAttachment)["Type"];
export type ContextUsage = (typeof ContextUsage)["Type"];
export type ClaudeFailureKind = (typeof ClaudeFailureKind)["Type"];
export type ClaudeFailure = (typeof ClaudeFailure)["Type"];
export type ClaudeEvent = (typeof ClaudeEvent)["Type"];
export type PromptResult = (typeof PromptResult)["Type"];

export const SIDECAR_METHODS = {
  "claude.prompt": {
    params: PromptParams,
    result: PromptResult,
    stream: ClaudeEvent,
  },
  "sidecar.emit": { params: EmitParams, result: EmitResult, stream: EmitChunk },
  "sidecar.info": {
    params: Schema.Null,
    result: SidecarInfo,
    stream: Schema.Never,
  },
} as const;

export type SidecarMethod = (typeof METHOD_NAMES)[number];

export type SidecarParams<M extends SidecarMethod> =
  (typeof SIDECAR_METHODS)[M]["params"]["Type"];

export type SidecarResult<M extends SidecarMethod> =
  (typeof SIDECAR_METHODS)[M]["result"]["Type"];

export type SidecarStream<M extends SidecarMethod> =
  (typeof SIDECAR_METHODS)[M]["stream"]["Type"];

export const HostFrame = Schema.Union([
  Schema.Struct({
    id: RequestId,
    method: Schema.String,
    params: Schema.Unknown,
    type: Schema.Literal("request"),
  }),
  Schema.Struct({
    id: RequestId,
    type: Schema.Literal("cancel"),
  }),
]);

export type HostFrame = (typeof HostFrame)["Type"];

export type SidecarRequestFrame = Extract<HostFrame, { type: "request" }>;

export const SidecarFrame = Schema.Union([
  Schema.Struct({
    pid: Schema.Int,
    protocol: Schema.Int,
    type: Schema.Literal("ready"),
  }),
  Schema.Struct({
    data: Schema.Unknown,
    id: RequestId,
    type: Schema.Literal("stream"),
  }),
  Schema.Struct({
    data: Schema.Unknown,
    id: RequestId,
    type: Schema.Literal("result"),
  }),
  Schema.Struct({
    id: RequestId,
    message: Schema.String,
    type: Schema.Literal("error"),
  }),
  Schema.Struct({
    channel: Schema.String,
    data: Schema.Unknown,
    type: Schema.Literal("notify"),
  }),
]);

export type SidecarFrame = (typeof SidecarFrame)["Type"];

export const SidecarPhase = Schema.Literals([
  "starting",
  "ready",
  "restarting",
  "down",
]);

export type SidecarPhase = (typeof SidecarPhase)["Type"];

export const SidecarStatus = Schema.Struct({
  attempt: Schema.Int,
  detail: Schema.NullOr(Schema.String),
  logPath: Schema.NullOr(Schema.String),
  phase: SidecarPhase,
  pid: Schema.NullOr(Schema.Int),
});

export type SidecarStatus = (typeof SidecarStatus)["Type"];

export const SidecarNotification = Schema.Struct({
  channel: Schema.String,
  data: Schema.Unknown,
});

export type SidecarNotification = (typeof SidecarNotification)["Type"];

export type Decoded<A> = Exit.Exit<A, SchemaError.SchemaError>;

type Decoder<A> = (input: unknown) => Decoded<A>;

export interface MethodCodecs<M extends SidecarMethod> {
  params: Decoder<SidecarParams<M>>;
  result: Decoder<SidecarResult<M>>;
  stream: Decoder<SidecarStream<M>>;
}

const CODECS = Object.fromEntries(
  METHOD_NAMES.map((method) => [
    method,
    {
      params: Schema.decodeUnknownExit(SIDECAR_METHODS[method].params),
      result: Schema.decodeUnknownExit(SIDECAR_METHODS[method].result),
      stream: Schema.decodeUnknownExit(SIDECAR_METHODS[method].stream),
    },
  ])
) as { [M in SidecarMethod]: MethodCodecs<M> };

export function codecsFor<M extends SidecarMethod>(method: M): MethodCodecs<M> {
  return CODECS[method];
}

export const decodeHostFrame: (line: string) => Decoded<HostFrame> =
  Schema.decodeExit(Schema.fromJsonString(HostFrame));

export const decodeMethod: Decoder<SidecarMethod> = Schema.decodeUnknownExit(
  Schema.Literals(METHOD_NAMES)
);

export const decodeSidecarStatus: Decoder<SidecarStatus> =
  Schema.decodeUnknownExit(SidecarStatus);

export const decodeSidecarNotification: Decoder<SidecarNotification> =
  Schema.decodeUnknownExit(SidecarNotification);
