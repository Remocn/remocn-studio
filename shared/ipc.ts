import { type Exit, Schema, type SchemaError } from "effect";

export const SIDECAR_PROTOCOL = 7;

export const SIDECAR_STATUS_EVENT = "sidecar://status";
export const SIDECAR_NOTIFY_EVENT = "sidecar://notify";

export const HOST_PID_ENV = "REMOCN_STUDIO_HOST_PID";
export const DATA_DIR_ENV = "REMOCN_STUDIO_DATA_DIR";
export const PREVIEW_ENTRY_ENV = "REMOCN_STUDIO_PREVIEW_ENTRY";

export const CANCELLED = "cancelled";

const RequestId = Schema.NonEmptyString;

export const METHOD_NAMES = [
  "claude.permission",
  "claude.prompt",
  "history.blocks",
  "history.remove",
  "history.sessions",
  "preview.start",
  "project.create",
  "project.list",
  "project.open",
  "project.relocate",
  "project.remove",
  "project.rename",
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
  effort: Schema.NullOr(EffortLevel),
  historyId: Schema.NonEmptyString,
  model: Schema.NullOr(Schema.NonEmptyString),
  projectId: Schema.NonEmptyString,
  prompt: Schema.String,
  sessionId: Schema.NullOr(Schema.NonEmptyString),
});

export const ActivityState = Schema.Literals(["done", "failed", "running"]);

export const TranscriptEntry = Schema.Union([
  Schema.Struct({
    attachments: Schema.Array(PromptAttachment),
    id: Schema.String,
    kind: Schema.Literal("user"),
    text: Schema.String,
  }),
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("assistant"),
    text: Schema.String,
  }),
  Schema.Struct({
    id: Schema.String,
    input: Schema.Unknown,
    kind: Schema.Literal("activity"),
    name: Schema.String,
    result: Schema.NullOr(Schema.String),
    state: ActivityState,
  }),
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("notice"),
    text: Schema.String,
  }),
]);

export const HistorySession = Schema.Struct({
  createdAt: Schema.Int,
  id: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  sdkSessionId: Schema.NullOr(Schema.String),
  title: Schema.String,
  updatedAt: Schema.Int,
});

export const HistorySessionRef = Schema.Struct({
  sessionId: Schema.NonEmptyString,
});

export const HistoryRemoved = Schema.Struct({ removed: Schema.Boolean });

export type ActivityState = (typeof ActivityState)["Type"];
export type TranscriptEntry = (typeof TranscriptEntry)["Type"];
export type ActivityEntry = Extract<TranscriptEntry, { kind: "activity" }>;
export type UserEntry = Extract<TranscriptEntry, { kind: "user" }>;
export type HistorySession = (typeof HistorySession)["Type"];
export type HistorySessionRef = (typeof HistorySessionRef)["Type"];
export type HistoryRemoved = (typeof HistoryRemoved)["Type"];

export const Project = Schema.Struct({
  createdAt: Schema.Int,
  id: Schema.NonEmptyString,
  missing: Schema.Boolean,
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  updatedAt: Schema.Int,
});

export const ProjectRef = Schema.Struct({
  projectId: Schema.NonEmptyString,
});

export const ProjectPath = Schema.Struct({
  path: Schema.NonEmptyString,
});

export const ProjectDraft = Schema.Struct({
  name: Schema.NonEmptyString,
  parent: Schema.NonEmptyString,
});

export const ProjectName = Schema.Struct({
  name: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export const ProjectMove = Schema.Struct({
  path: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export const ProjectRemoved = Schema.Struct({ removed: Schema.Boolean });

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

export const PermissionReason = Schema.Literals(["bash", "outside", "tool"]);

export const PermissionDecision = Schema.Literals(["allow", "always", "deny"]);

export const PermissionParams = Schema.Struct({
  decision: PermissionDecision,
  id: Schema.NonEmptyString,
});

export const PermissionAnswer = Schema.Struct({ matched: Schema.Boolean });

export const ClaudeEvent = Schema.Union([
  Schema.Struct({
    model: Schema.String,
    sessionId: Schema.String,
    type: Schema.Literal("session"),
  }),
  Schema.Struct({
    session: HistorySession,
    type: Schema.Literal("history"),
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
  Schema.Struct({
    id: Schema.String,
    input: Schema.Unknown,
    name: Schema.String,
    reason: PermissionReason,
    type: Schema.Literal("permission"),
  }),
]);

export const PromptResult = Schema.Struct({
  context: Schema.NullOr(ContextUsage),
  failure: Schema.NullOr(ClaudeFailure),
  sessionId: Schema.NullOr(Schema.String),
});

export type PromptParams = (typeof PromptParams)["Type"];
export type EffortLevel = (typeof EffortLevel)["Type"];
export type PermissionReason = (typeof PermissionReason)["Type"];
export type PermissionDecision = (typeof PermissionDecision)["Type"];
export type PermissionParams = (typeof PermissionParams)["Type"];
export type PermissionAnswer = (typeof PermissionAnswer)["Type"];
export type ImageMediaType = (typeof ImageMediaType)["Type"];
export type PromptAttachment = (typeof PromptAttachment)["Type"];
export type Project = (typeof Project)["Type"];
export type ProjectRef = (typeof ProjectRef)["Type"];
export type ProjectPath = (typeof ProjectPath)["Type"];
export type ProjectDraft = (typeof ProjectDraft)["Type"];
export type ProjectName = (typeof ProjectName)["Type"];
export type ProjectMove = (typeof ProjectMove)["Type"];
export type ProjectRemoved = (typeof ProjectRemoved)["Type"];
export type ContextUsage = (typeof ContextUsage)["Type"];
export type ClaudeFailureKind = (typeof ClaudeFailureKind)["Type"];
export type ClaudeFailure = (typeof ClaudeFailure)["Type"];
export type ClaudeEvent = (typeof ClaudeEvent)["Type"];
export type PromptResult = (typeof PromptResult)["Type"];

export const PreviewParams = Schema.Struct({
  projectId: Schema.NonEmptyString,
});

export const PreviewEvent = Schema.Union([
  Schema.Struct({
    percent: Schema.Int,
    type: Schema.Literal("building"),
  }),
  Schema.Struct({
    type: Schema.Literal("ready"),
    url: Schema.NonEmptyString,
  }),
  Schema.Struct({
    message: Schema.String,
    type: Schema.Literal("failed"),
  }),
]);

export const PreviewResult = Schema.Struct({ reason: Schema.String });

export type PreviewParams = (typeof PreviewParams)["Type"];
export type PreviewEvent = (typeof PreviewEvent)["Type"];
export type PreviewResult = (typeof PreviewResult)["Type"];

export const SIDECAR_METHODS = {
  "claude.permission": {
    params: PermissionParams,
    result: PermissionAnswer,
    stream: Schema.Never,
  },
  "claude.prompt": {
    params: PromptParams,
    result: PromptResult,
    stream: ClaudeEvent,
  },
  "history.blocks": {
    params: HistorySessionRef,
    result: Schema.Array(TranscriptEntry),
    stream: Schema.Never,
  },
  "history.remove": {
    params: HistorySessionRef,
    result: HistoryRemoved,
    stream: Schema.Never,
  },
  "history.sessions": {
    params: Schema.Null,
    result: Schema.Array(HistorySession),
    stream: Schema.Never,
  },
  "preview.start": {
    params: PreviewParams,
    result: PreviewResult,
    stream: PreviewEvent,
  },
  "project.create": {
    params: ProjectDraft,
    result: Project,
    stream: Schema.Never,
  },
  "project.list": {
    params: Schema.Null,
    result: Schema.Array(Project),
    stream: Schema.Never,
  },
  "project.open": {
    params: ProjectPath,
    result: Project,
    stream: Schema.Never,
  },
  "project.relocate": {
    params: ProjectMove,
    result: Project,
    stream: Schema.Never,
  },
  "project.remove": {
    params: ProjectRef,
    result: ProjectRemoved,
    stream: Schema.Never,
  },
  "project.rename": {
    params: ProjectName,
    result: Project,
    stream: Schema.Never,
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
