import { Effect, type Exit, Schema, type SchemaError } from "effect";
import { Asset, AssetDraft, PromptAsset } from "./library";
import { PipelineStage, PipelineStageId, PipelineStatus } from "./pipeline";

export const SIDECAR_PROTOCOL = 19;

export const SIDECAR_STATUS_EVENT = "sidecar://status";
export const SIDECAR_NOTIFY_EVENT = "sidecar://notify";
export const QUIT_REQUESTED_EVENT = "app://quit-requested";

export const HOST_PID_ENV = "REMOCN_STUDIO_HOST_PID";
export const DATA_DIR_ENV = "REMOCN_STUDIO_DATA_DIR";
export const PREVIEW_ENTRY_ENV = "REMOCN_STUDIO_PREVIEW_ENTRY";
export const GRAB_SCRIPT_ENV = "REMOCN_STUDIO_GRAB_SCRIPT";
export const TEMPLATE_DIR_ENV = "REMOCN_STUDIO_TEMPLATE_DIR";
export const PLUGIN_DIR_ENV = "REMOCN_STUDIO_PLUGIN_DIR";
export const LIBRARY_DIR_ENV = "REMOCN_STUDIO_LIBRARY_DIR";
export const REMOCN_DIR_ENV = "REMOCN_STUDIO_REMOCN_DIR";

export const CANCELLED = "cancelled";

const RequestId = Schema.NonEmptyString;

export const METHOD_NAMES = [
  "claude.permission",
  "claude.prompt",
  "files.list",
  "history.blocks",
  "history.mode",
  "history.remove",
  "history.sessions",
  "library.bundled",
  "library.dismiss",
  "library.list",
  "library.offer",
  "library.preview",
  "library.proxy",
  "library.remove",
  "library.rename",
  "library.save",
  "pipeline.get",
  "pipeline.set",
  "pipeline.start",
  "preview.export",
  "preview.start",
  "preview.still",
  "preview.warm",
  "project.check",
  "project.create",
  "project.files",
  "project.install",
  "project.list",
  "project.open",
  "project.relocate",
  "project.remove",
  "project.rename",
  "project.scaffold",
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

export const SESSION_MODES = ["auto", "acceptEdits", "plan"] as const;

export const SessionMode = Schema.Literals(SESSION_MODES);

export const DEFAULT_SESSION_MODE = "auto" satisfies SessionMode;

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  acceptEdits: "Accept edits",
  auto: "Auto",
  plan: "Plan",
};

export function isSessionMode(value: unknown): value is SessionMode {
  return (
    typeof value === "string" &&
    (SESSION_MODES as readonly string[]).includes(value)
  );
}

export const IMAGE_MEDIA_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const VIDEO_MEDIA_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const AUDIO_MEDIA_TYPES = [
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

export const MEDIA_TYPES = [
  ...IMAGE_MEDIA_TYPES,
  ...VIDEO_MEDIA_TYPES,
  ...AUDIO_MEDIA_TYPES,
] as const;

export const ImageMediaType = Schema.Literals(IMAGE_MEDIA_TYPES);

export const MediaType = Schema.Literals(MEDIA_TYPES);

export const PromptAttachment = Schema.Struct({
  mediaType: ImageMediaType,
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
});

export const PromptMedia = Schema.Struct({
  mediaType: MediaType,
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
});

export const ElementScene = Schema.Struct({
  durationInFrames: Schema.Int,
  frame: Schema.Int,
  from: Schema.Int,
  name: Schema.String,
});

export const PromptElement = Schema.Struct({
  column: Schema.NullOr(Schema.Int),
  component: Schema.NullOr(Schema.String),
  composition: Schema.String,
  file: Schema.NullOr(Schema.NonEmptyString),
  fps: Schema.Finite,
  frame: Schema.Int,
  html: Schema.String,
  line: Schema.NullOr(Schema.Int),
  scene: Schema.NullOr(ElementScene),
  stack: Schema.Array(Schema.String),
});

const elements = Schema.Array(PromptElement).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

const assets = Schema.Array(PromptAsset).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

const media = Schema.Array(PromptMedia).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

export const PromptFrame = Schema.Struct({
  composition: Schema.NonEmptyString,
  frame: Schema.Int,
});

const frame = Schema.NullOr(PromptFrame).pipe(
  Schema.withDecodingDefault(Effect.succeed(null))
);

export const PromptParams = Schema.Struct({
  assets,
  attachments: Schema.Array(PromptAttachment),
  effort: Schema.NullOr(EffortLevel),
  elements,
  historyId: Schema.NonEmptyString,
  media,
  mode: SessionMode,
  model: Schema.NullOr(Schema.NonEmptyString),
  playing: frame,
  projectId: Schema.NonEmptyString,
  prompt: Schema.String,
  sessionId: Schema.NullOr(Schema.NonEmptyString),
});

export const ActivityState = Schema.Literals(["done", "failed", "running"]);

export const TranscriptEntry = Schema.Union([
  Schema.Struct({
    assets,
    attachments: Schema.Array(PromptAttachment),
    elements,
    id: Schema.String,
    kind: Schema.Literal("user"),
    media,
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
  mode: SessionMode,
  projectId: Schema.NonEmptyString,
  sdkSessionId: Schema.NullOr(Schema.String),
  title: Schema.String,
  updatedAt: Schema.Int,
});

export const HistorySessionRef = Schema.Struct({
  sessionId: Schema.NonEmptyString,
});

export const HistorySessionMode = Schema.Struct({
  mode: SessionMode,
  sessionId: Schema.NonEmptyString,
});

export const HistoryRemoved = Schema.Struct({ removed: Schema.Boolean });

export const AssetRef = Schema.Struct({
  slug: Schema.NonEmptyString,
});

export const AssetName = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
});

export const AssetRemoved = Schema.Struct({ removed: Schema.Boolean });

export const AssetPreview = Schema.Struct({
  duration: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  path: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
});

// A null path is the decision that this asset needs no proxy, recorded so the
// webview stops measuring it on every listing.
export const AssetProxy = Schema.Struct({
  path: Schema.NullOr(Schema.NonEmptyString),
  slug: Schema.NonEmptyString,
});

export const AssetCandidates = Schema.Struct({
  attachments: Schema.Array(PromptMedia),
});

export const AssetDismissed = Schema.Struct({ dismissed: Schema.Int });

export const PipelineState = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  stages: Schema.Array(PipelineStage),
});

export const PipelineStageChange = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  stage: PipelineStageId,
  status: PipelineStatus,
});

export type ActivityState = (typeof ActivityState)["Type"];
export type TranscriptEntry = (typeof TranscriptEntry)["Type"];
export type ActivityEntry = Extract<TranscriptEntry, { kind: "activity" }>;
export type UserEntry = Extract<TranscriptEntry, { kind: "user" }>;
export type SessionMode = (typeof SessionMode)["Type"];
export type HistorySession = (typeof HistorySession)["Type"];
export type HistorySessionRef = (typeof HistorySessionRef)["Type"];
export type HistorySessionMode = (typeof HistorySessionMode)["Type"];
export type HistoryRemoved = (typeof HistoryRemoved)["Type"];
export type AssetRef = (typeof AssetRef)["Type"];
export type AssetName = (typeof AssetName)["Type"];
export type AssetRemoved = (typeof AssetRemoved)["Type"];
export type AssetPreview = (typeof AssetPreview)["Type"];
export type AssetProxy = (typeof AssetProxy)["Type"];
export type AssetCandidates = (typeof AssetCandidates)["Type"];
export type AssetDismissed = (typeof AssetDismissed)["Type"];
export type PromptFrame = (typeof PromptFrame)["Type"];
export type PipelineState = (typeof PipelineState)["Type"];
export type PipelineStageChange = (typeof PipelineStageChange)["Type"];

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

export const ProjectFiles = Schema.Struct({
  files: Schema.Array(Schema.NonEmptyString),
  root: Schema.NonEmptyString,
  truncated: Schema.Boolean,
});

export const DirectoryPath = Schema.Struct({
  path: Schema.NonEmptyString,
});

export const DirectoryEntry = Schema.Struct({
  directory: Schema.Boolean,
  name: Schema.NonEmptyString,
});

export const DirectoryListing = Schema.Struct({
  entries: Schema.Array(DirectoryEntry),
  path: Schema.NonEmptyString,
});

export const VideoSize = Schema.Struct({
  height: Schema.Int,
  width: Schema.Int,
});

export const ScaffoldParams = Schema.Struct({
  height: Schema.Int,
  projectId: Schema.NonEmptyString,
  width: Schema.Int,
});

export const SCAFFOLD_STEPS = ["template", "install"] as const;

export const ScaffoldStep = Schema.Literals(SCAFFOLD_STEPS);

export const ScaffoldEvent = Schema.Union([
  Schema.Struct({
    step: ScaffoldStep,
    type: Schema.Literal("started"),
  }),
  Schema.Struct({
    step: ScaffoldStep,
    type: Schema.Literal("done"),
  }),
]);

export const ENVIRONMENT_CHECKS = [
  "claude",
  "runtime",
  "remotion",
  "dependencies",
  "entry",
  "compositions",
] as const;

export const EnvironmentCheckId = Schema.Literals(ENVIRONMENT_CHECKS);

export const ENVIRONMENT_STATES = ["ok", "warn", "failed", "pending"] as const;

export const EnvironmentState = Schema.Literals(ENVIRONMENT_STATES);

export const EnvironmentFix = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("install"),
  }),
  Schema.Struct({
    command: Schema.NonEmptyString,
    type: Schema.Literal("command"),
  }),
]);

export const EnvironmentCheck = Schema.Struct({
  detail: Schema.NullOr(Schema.String),
  fix: Schema.NullOr(EnvironmentFix),
  id: EnvironmentCheckId,
  state: EnvironmentState,
  title: Schema.String,
});

export const EnvironmentReport = Schema.Struct({
  checks: Schema.Array(EnvironmentCheck),
});

export const EnvironmentParams = Schema.Struct({
  force: Schema.Boolean,
  projectId: Schema.NonEmptyString,
});

export const InstallEvent = Schema.Struct({
  line: Schema.String,
  type: Schema.Literal("output"),
});

export const Installed = Schema.Struct({ installed: Schema.Boolean });

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

export const PermissionReason = Schema.Literals([
  "bash",
  "outside",
  "plan",
  "tool",
]);

export const PermissionDecision = Schema.Literals(["allow", "always", "deny"]);

export const PermissionParams = Schema.Struct({
  decision: PermissionDecision,
  id: Schema.NonEmptyString,
  mode: Schema.NullOr(SessionMode),
});

export const PermissionAnswer = Schema.Struct({ matched: Schema.Boolean });

export const ClaudeEvent = Schema.Union([
  Schema.Struct({
    mode: Schema.NullOr(SessionMode),
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
export type MediaType = (typeof MediaType)["Type"];
export type PromptAttachment = (typeof PromptAttachment)["Type"];
export type PromptMedia = (typeof PromptMedia)["Type"];
export type ElementScene = (typeof ElementScene)["Type"];
export type PromptElement = (typeof PromptElement)["Type"];
export type Project = (typeof Project)["Type"];
export type ProjectRef = (typeof ProjectRef)["Type"];
export type ProjectPath = (typeof ProjectPath)["Type"];
export type ProjectDraft = (typeof ProjectDraft)["Type"];
export type ProjectName = (typeof ProjectName)["Type"];
export type ProjectMove = (typeof ProjectMove)["Type"];
export type ProjectRemoved = (typeof ProjectRemoved)["Type"];
export type ProjectFiles = (typeof ProjectFiles)["Type"];
export type DirectoryPath = (typeof DirectoryPath)["Type"];
export type DirectoryEntry = (typeof DirectoryEntry)["Type"];
export type DirectoryListing = (typeof DirectoryListing)["Type"];
export type VideoSize = (typeof VideoSize)["Type"];
export type ScaffoldParams = (typeof ScaffoldParams)["Type"];
export type ScaffoldStep = (typeof ScaffoldStep)["Type"];
export type ScaffoldEvent = (typeof ScaffoldEvent)["Type"];
export type EnvironmentCheckId = (typeof EnvironmentCheckId)["Type"];
export type EnvironmentState = (typeof EnvironmentState)["Type"];
export type EnvironmentFix = (typeof EnvironmentFix)["Type"];
export type EnvironmentCheck = (typeof EnvironmentCheck)["Type"];
export type EnvironmentReport = (typeof EnvironmentReport)["Type"];
export type EnvironmentParams = (typeof EnvironmentParams)["Type"];
export type InstallEvent = (typeof InstallEvent)["Type"];
export type Installed = (typeof Installed)["Type"];
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

export const StillParams = Schema.Struct({
  composition: Schema.NonEmptyString,
  frame: Schema.Int,
  projectId: Schema.NonEmptyString,
});

export const StillEvent = Schema.Union([
  Schema.Struct({
    percent: Schema.Int,
    type: Schema.Literal("browser"),
  }),
  Schema.Struct({
    type: Schema.Literal("rendering"),
  }),
]);

export const Still = Schema.Struct({
  height: Schema.Int,
  path: Schema.NonEmptyString,
  width: Schema.Int,
});

export const WarmParams = Schema.Struct({
  composition: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export const Warmed = Schema.Struct({ warmed: Schema.Boolean });

export const ExportParams = Schema.Struct({
  composition: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export const ExportStage = Schema.Literals(["encoding", "muxing"]);

export const ExportEvent = Schema.Union([
  Schema.Struct({
    percent: Schema.Int,
    type: Schema.Literal("browser"),
  }),
  Schema.Struct({
    encoded: Schema.Int,
    percent: Schema.Int,
    rendered: Schema.Int,
    stage: ExportStage,
    total: Schema.Int,
    type: Schema.Literal("progress"),
  }),
]);

export const Exported = Schema.Struct({
  bytes: Schema.Int,
  path: Schema.NonEmptyString,
});

export type PreviewParams = (typeof PreviewParams)["Type"];
export type PreviewEvent = (typeof PreviewEvent)["Type"];
export type PreviewResult = (typeof PreviewResult)["Type"];
export type StillParams = (typeof StillParams)["Type"];
export type StillEvent = (typeof StillEvent)["Type"];
export type Still = (typeof Still)["Type"];
export type WarmParams = (typeof WarmParams)["Type"];
export type Warmed = (typeof Warmed)["Type"];
export type ExportParams = (typeof ExportParams)["Type"];
export type ExportStage = (typeof ExportStage)["Type"];
export type ExportEvent = (typeof ExportEvent)["Type"];
export type ExportProgress = Extract<ExportEvent, { type: "progress" }>;
export type Exported = (typeof Exported)["Type"];

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
  "files.list": {
    params: DirectoryPath,
    result: DirectoryListing,
    stream: Schema.Never,
  },
  "history.blocks": {
    params: HistorySessionRef,
    result: Schema.Array(TranscriptEntry),
    stream: Schema.Never,
  },
  "history.mode": {
    params: HistorySessionMode,
    result: HistorySession,
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
  "library.bundled": {
    params: Schema.Null,
    result: Schema.Array(Asset),
    stream: Schema.Never,
  },
  "library.dismiss": {
    params: AssetCandidates,
    result: AssetDismissed,
    stream: Schema.Never,
  },
  "library.list": {
    params: Schema.Null,
    result: Schema.Array(Asset),
    stream: Schema.Never,
  },
  "library.offer": {
    params: AssetCandidates,
    result: Schema.Array(PromptMedia),
    stream: Schema.Never,
  },
  "library.preview": {
    params: AssetPreview,
    result: Asset,
    stream: Schema.Never,
  },
  "library.proxy": {
    params: AssetProxy,
    result: Asset,
    stream: Schema.Never,
  },
  "library.remove": {
    params: AssetRef,
    result: AssetRemoved,
    stream: Schema.Never,
  },
  "library.rename": {
    params: AssetName,
    result: Asset,
    stream: Schema.Never,
  },
  "library.save": {
    params: AssetDraft,
    result: Asset,
    stream: Schema.Never,
  },
  "pipeline.get": {
    params: HistorySessionRef,
    result: PipelineState,
    stream: Schema.Never,
  },
  "pipeline.set": {
    params: PipelineStageChange,
    result: PipelineState,
    stream: Schema.Never,
  },
  "pipeline.start": {
    params: HistorySessionRef,
    result: PipelineState,
    stream: Schema.Never,
  },
  "preview.export": {
    params: ExportParams,
    result: Exported,
    stream: ExportEvent,
  },
  "preview.start": {
    params: PreviewParams,
    result: PreviewResult,
    stream: PreviewEvent,
  },
  "preview.still": {
    params: StillParams,
    result: Still,
    stream: StillEvent,
  },
  "preview.warm": {
    params: WarmParams,
    result: Warmed,
    stream: Schema.Never,
  },
  "project.check": {
    params: EnvironmentParams,
    result: EnvironmentReport,
    stream: Schema.Never,
  },
  "project.create": {
    params: ProjectDraft,
    result: Project,
    stream: Schema.Never,
  },
  "project.files": {
    params: ProjectRef,
    result: ProjectFiles,
    stream: Schema.Never,
  },
  "project.install": {
    params: ProjectRef,
    result: Installed,
    stream: InstallEvent,
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
  "project.scaffold": {
    params: ScaffoldParams,
    result: Project,
    stream: ScaffoldEvent,
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

export const APP_ENVIRONMENTS = ["development", "production"] as const;

export const AppEnvironment = Schema.Literals(APP_ENVIRONMENTS);

export type AppEnvironment = (typeof AppEnvironment)["Type"];

export const StudioBuild = Schema.Struct({
  environment: AppEnvironment,
  version: Schema.String,
});

export type StudioBuild = (typeof StudioBuild)["Type"];

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

export const decodeStudioBuild: Decoder<StudioBuild> =
  Schema.decodeUnknownExit(StudioBuild);
