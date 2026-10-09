import { Effect, type Exit, Schema, type SchemaError } from "effect";
import { Audiomap } from "./audiomap";
import {
  BrandFile,
  BrandFont,
  ProjectBrandApplication,
  ProjectBrandSnapshot,
} from "./brand";
import { DesignImport } from "./design-import";
import {
  DEFAULT_FORMAT,
  EXPORT_FORMATS,
  EXPORT_PRESETS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
} from "./export";
import { Connections } from "./integrations";
import {
  Asset,
  AssetDraft,
  PromptAsset,
  StockItem,
  StockKind,
  StockPage,
} from "./library";
import { PipelineStage, PipelineStageId, PipelineStatus } from "./pipeline";
import { ProjectConfig, ProjectSettingsDraft } from "./project-config";
import {
  AgentProvider,
  DEFAULT_AGENT_PROVIDER,
  ProviderStep,
  ToolVerb,
} from "./providers";
import { AudioRequest, SoundOperation, SoundRef } from "./sound-effects";
import {
  StudioDocumentRef,
  StudioObjectOperation,
  StudioOperation,
  StudioSnapshot,
} from "./studio-document";
import { TemplateDraft } from "./templates";

export const SIDECAR_PROTOCOL = 38;

export const SIDECAR_STATUS_EVENT = "sidecar://status";
export const SIDECAR_NOTIFY_EVENT = "sidecar://notify";
export const QUIT_REQUESTED_EVENT = "app://quit-requested";
export const DEEP_LINK_EVENT = "app://deep-link";

export const HOST_PID_ENV = "REMOCN_STUDIO_HOST_PID";
export const DATA_DIR_ENV = "REMOCN_STUDIO_DATA_DIR";
export const PREVIEW_ENTRY_ENV = "REMOCN_STUDIO_PREVIEW_ENTRY";
export const TEMPLATE_DIR_ENV = "REMOCN_STUDIO_TEMPLATE_DIR";
export const PLUGIN_DIR_ENV = "REMOCN_STUDIO_PLUGIN_DIR";
export const LIBRARY_DIR_ENV = "REMOCN_STUDIO_LIBRARY_DIR";
export const REMOCN_DIR_ENV = "REMOCN_STUDIO_REMOCN_DIR";
export const PEXELS_KEY_ENV = "REMOCN_STUDIO_PEXELS_KEY";

// What the core knows about its own build and the sidecar cannot work out for
// itself: in a release the sidecar is one bundled `main.js` with no
// package.json beside it, and in debug it runs from the repo, where a DSN in
// `.env` would otherwise make a developer's own tree report as production.
export const APP_ENVIRONMENT_ENV = "REMOCN_STUDIO_ENVIRONMENT";
export const APP_VERSION_ENV = "REMOCN_STUDIO_VERSION";

export const CANCELLED = "cancelled";

const RequestId = Schema.NonEmptyString;

export const METHOD_NAMES = [
  "agent.accounts",
  "agent.permission",
  "agent.prompt",
  "agent.source",
  "crash.consent",
  "files.list",
  "history.blocks",
  "history.mode",
  "history.record",
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
  "library.stockSave",
  "library.stockSearch",
  "library.stockStatus",
  "node.install",
  "pipeline.get",
  "pipeline.set",
  "pipeline.start",
  "preview.export",
  "preview.remove",
  "preview.restore",
  "preview.start",
  "preview.status",
  "preview.still",
  "preview.warm",
  "preview.write",
  "studio.read",
  "studio.patch",
  "studio.remove",
  "project.check",
  "project.create",
  "project.move",
  "project.moveCancel",
  "project.settingsGet",
  "project.settingsSave",
  "project.brandFile",
  "project.designImport",
  "project.googleFont",
  "project.files",
  "project.fromTemplate",
  "project.install",
  "project.list",
  "project.open",
  "project.read",
  "project.relocate",
  "project.remove",
  "project.rename",
  "project.scaffold",
  "project.upgrade",
  "sidecar.emit",
  "sidecar.info",
  "video.brandStatus",
  "video.brandConfirm",
  "video.create",
  "video.documents",
  "video.list",
  "video.reconcile",
  "video.register",
  "video.remove",
  "video.rename",
  "video.restore",
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

// Video and audio are never sent to the model: they are copied into the
// project's `public/library/` and handed to the agent as a `staticFile()` path,
// and Remotion plays whatever the project's own renderer can decode. So there
// is nothing here to be strict about — `.m4v` is what the Apple ecosystem
// exports and `.mkv` / `.avi` is what stock footage arrives in, and refusing
// them bought nothing.
export const VIDEO_MEDIA_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-msvideo",
] as const;

export const AUDIO_MEDIA_TYPES = [
  "audio/aac",
  "audio/aiff",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
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
  audiomap: Schema.optionalKey(Schema.NullOr(Audiomap)),
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

export const TuningValue = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.Union([Schema.Finite, Schema.String, Schema.Boolean, Schema.Null])
  ),
]);

export const TuningOwner = Schema.Struct({
  component: Schema.NonEmptyString,
  file: Schema.NullOr(Schema.NonEmptyString),
  line: Schema.NullOr(Schema.Int),
  name: Schema.NullOr(Schema.String),
});

export const TuningChange = Schema.Struct({
  from: TuningValue,
  owner: Schema.optionalKey(TuningOwner),
  path: Schema.NonEmptyString,
  sampled: Schema.optionalKey(Schema.Boolean),
  to: TuningValue,
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
  tuningChanges: Schema.optionalKey(Schema.Array(TuningChange)),
  // Whether the studio wrote these changes into the file itself. The agent is
  // told about them so it does not make them a second time, which is the whole
  // difference between the two chips one Add can leave in the composer.
  written: Schema.optionalKey(Schema.Boolean),
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

const provider = AgentProvider.pipe(
  Schema.withDecodingDefault(Effect.succeed(DEFAULT_AGENT_PROVIDER))
);

export const PromptParams = Schema.Struct({
  assets,
  attachments: Schema.Array(PromptAttachment),
  brandRevision: Schema.optionalKey(Schema.Int),
  effort: Schema.NullOr(EffortLevel),
  elements,
  historyId: Schema.NonEmptyString,
  media,
  mode: SessionMode,
  model: Schema.NullOr(Schema.NonEmptyString),
  playing: frame,
  projectId: Schema.NonEmptyString,
  prompt: Schema.String,
  provider,
  sessionId: Schema.NullOr(Schema.NonEmptyString),
  videoId: Schema.NonEmptyString,
});

export const ActivityState = Schema.Literals(["done", "failed", "running"]);

// The verb is the adapter's translation of its own tool name into the neutral
// vocabulary the icons key on. Rows stored before it existed decode to null
// and fall back to the name.
const verb = Schema.NullOr(ToolVerb).pipe(
  Schema.withDecodingDefault(Effect.succeed(null))
);

export const SoundResult = Schema.Struct({
  asset: Asset,
  operationId: Schema.NonEmptyString,
  request: AudioRequest,
});
export type SoundResult = typeof SoundResult.Type;

export const TranscriptEntry = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("sound"),
    result: SoundResult,
  }),
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
    verb,
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
  provider,
  sdkSessionId: Schema.NullOr(Schema.String),
  title: Schema.String,
  updatedAt: Schema.Int,
  videoId: Schema.NonEmptyString,
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
  audiomap: Schema.NullOr(Audiomap).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
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

export const StockQuery = Schema.Struct({
  kind: StockKind,
  page: Schema.Int,
  query: Schema.NonEmptyString,
});

// A null key forgets the stored one; whether a key is configured is all the
// webview may learn — the key itself never travels back.
export const StockKeyChange = Schema.Struct({
  key: Schema.NullOr(Schema.NonEmptyString),
});

export const StockConfigured = Schema.Struct({ configured: Schema.Boolean });

export const StockProgress = Schema.Struct({
  received: Schema.Int,
  total: Schema.NullOr(Schema.Int),
});

// Consent reaches the sidecar twice, and the two are not redundant. Rust
// reads `settings.json` and passes the answer as an env var at spawn, so a
// crash in the first seconds — before any webview has connected — is still
// reported when it was consented to. This method is the *live* half: turning
// the switch off has to stop the sending now, not at the next launch.
export const CrashConsent = Schema.Struct({ enabled: Schema.Boolean });

// What the sidecar is actually doing, which is not the same as what it was
// told: consent is one of three conditions, and a build with no DSN or a
// development one reports nothing however the switch is set.
export const CrashReporting = Schema.Struct({ reporting: Schema.Boolean });

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
export type StockQuery = (typeof StockQuery)["Type"];
export type StockKeyChange = (typeof StockKeyChange)["Type"];
export type StockConfigured = (typeof StockConfigured)["Type"];
export type StockProgress = (typeof StockProgress)["Type"];
export type CrashConsent = (typeof CrashConsent)["Type"];
export type CrashReporting = (typeof CrashReporting)["Type"];
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

export const Video = Schema.Struct({
  compositionId: Schema.NonEmptyString,
  createdAt: Schema.Int,
  deletedAt: Schema.NullOr(Schema.Int),
  id: Schema.NonEmptyString,
  missing: Schema.Boolean,
  name: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  updatedAt: Schema.Int,
});

export const VideoRef = Schema.Struct({
  videoId: Schema.NonEmptyString,
});

export const VideoDraft = Schema.Struct({
  height: Schema.Int,
  name: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  width: Schema.Int,
});

export const TemplateProject = Schema.Struct({
  project: Project,
  video: Video,
});

export const VideoName = Schema.Struct({
  name: Schema.NonEmptyString,
  videoId: Schema.NonEmptyString,
});

export const VideoRemoved = Schema.Struct({ removed: Schema.Boolean });

export const ProjectFile = Schema.Struct({
  modifiedAt: Schema.Int,
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
});

// The folder rides back beside the files so an empty answer can still say
// where the documents would go — the pane's empty state names it.
export const VideoDocuments = Schema.Struct({
  files: Schema.Array(ProjectFile),
  folder: Schema.NonEmptyString,
});

export const DocumentRef = Schema.Struct({
  path: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export const DocumentText = Schema.Struct({
  modifiedAt: Schema.Int,
  text: Schema.String,
});

export const VideoReconcile = Schema.Struct({
  compositions: Schema.Array(Schema.NonEmptyString),
  projectId: Schema.NonEmptyString,
});

export const ScaffoldParams = ProjectRef;

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
  "codex",
  "copilot",
  "grok",
  "manager",
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
    type: Schema.Literal("node"),
  }),
  Schema.Struct({
    command: Schema.NonEmptyString,
    type: Schema.Literal("command"),
  }),
  Schema.Struct({
    step: ProviderStep,
    type: Schema.Literal("provider"),
  }),
  Schema.Struct({
    packages: Schema.Array(Schema.NonEmptyString),
    type: Schema.Literal("upgrade"),
    version: Schema.NonEmptyString,
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
  provider,
});

export const InstallEvent = Schema.Struct({
  line: Schema.String,
  type: Schema.Literal("output"),
});

export const Installed = Schema.Struct({ installed: Schema.Boolean });

export const UpgradeParams = Schema.Struct({
  packages: Schema.Array(Schema.NonEmptyString),
  projectId: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
});

export const Upgraded = Schema.Struct({ upgraded: Schema.Boolean });

export const NodeDownload = Schema.Struct({
  received: Schema.Int,
  total: Schema.NullOr(Schema.Int),
  type: Schema.Literal("progress"),
});

export const NodeInstaller = Schema.Struct({
  opened: Schema.Boolean,
  version: Schema.NonEmptyString,
});

export const ContextUsage = Schema.Struct({
  maxTokens: Schema.Int,
  totalTokens: Schema.Int,
});

export const AgentFailureKind = Schema.Literals([
  "auth",
  "usage",
  "model",
  "unknown",
]);

export const AgentFailure = Schema.Struct({
  kind: AgentFailureKind,
  message: Schema.String,
});

export const PermissionReason = Schema.Literals([
  "bash",
  "outside",
  "outward",
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

export const SourceAssetAction = Schema.Literals([
  "uploaded",
  "screenshot",
  "cancel",
]);

export const SourceAssetParams = Schema.Struct({
  action: SourceAssetAction,
  file: Schema.NullOr(Schema.String),
  id: Schema.NonEmptyString,
});

export const SourceAssetAnswer = Schema.Struct({ matched: Schema.Boolean });

export const SourceAssetResolution = Schema.Struct({
  kind: Schema.Literals(["uploaded", "screenshot", "cancelled"]),
  path: Schema.NullOr(Schema.NonEmptyString),
  provenance: Schema.NonEmptyString,
});

export const AgentEvent = Schema.Union([
  Schema.Struct({
    result: SoundResult,
    type: Schema.Literal("sound_result"),
  }),
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
    verb,
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
  Schema.Struct({
    attempt: Schema.String,
    id: Schema.NonEmptyString,
    name: Schema.NonEmptyString,
    source: Schema.NonEmptyString,
    type: Schema.Literal("asset_source"),
  }),
  Schema.Struct({
    stages: Schema.Array(PipelineStage),
    type: Schema.Literal("pipeline"),
  }),
]);

export const PromptResult = Schema.Struct({
  context: Schema.NullOr(ContextUsage),
  failure: Schema.NullOr(AgentFailure),
  sessionId: Schema.NullOr(Schema.String),
});

export type PromptParams = (typeof PromptParams)["Type"];
export type EffortLevel = (typeof EffortLevel)["Type"];
export type PermissionReason = (typeof PermissionReason)["Type"];
export type PermissionDecision = (typeof PermissionDecision)["Type"];
export type PermissionParams = (typeof PermissionParams)["Type"];
export type PermissionAnswer = (typeof PermissionAnswer)["Type"];
export type SourceAssetAction = (typeof SourceAssetAction)["Type"];
export type SourceAssetParams = (typeof SourceAssetParams)["Type"];
export type SourceAssetAnswer = (typeof SourceAssetAnswer)["Type"];
export type SourceAssetResolution = (typeof SourceAssetResolution)["Type"];
export type ImageMediaType = (typeof ImageMediaType)["Type"];
export type MediaType = (typeof MediaType)["Type"];
export type PromptAttachment = (typeof PromptAttachment)["Type"];
export type PromptMedia = (typeof PromptMedia)["Type"];
export type ElementScene = (typeof ElementScene)["Type"];
export type PromptElement = (typeof PromptElement)["Type"];
export type TuningChange = (typeof TuningChange)["Type"];
export type TuningOwner = (typeof TuningOwner)["Type"];
export type TuningValue = (typeof TuningValue)["Type"];
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
export type Video = (typeof Video)["Type"];
export type VideoRef = (typeof VideoRef)["Type"];
export type ProjectFile = (typeof ProjectFile)["Type"];
export type VideoDocuments = (typeof VideoDocuments)["Type"];
export type DocumentRef = (typeof DocumentRef)["Type"];
export type DocumentText = (typeof DocumentText)["Type"];
export type VideoDraft = (typeof VideoDraft)["Type"];
export type TemplateProject = (typeof TemplateProject)["Type"];
export type VideoName = (typeof VideoName)["Type"];
export type VideoRemoved = (typeof VideoRemoved)["Type"];
export type VideoReconcile = (typeof VideoReconcile)["Type"];
export type ScaffoldParams = (typeof ScaffoldParams)["Type"];
export type ScaffoldStep = (typeof ScaffoldStep)["Type"];
export type ScaffoldEvent = (typeof ScaffoldEvent)["Type"];
export type EnvironmentCheckId = (typeof EnvironmentCheckId)["Type"];
export type EnvironmentState = (typeof EnvironmentState)["Type"];
export type EnvironmentFix = (typeof EnvironmentFix)["Type"];
export type EnvironmentCheck = (typeof EnvironmentCheck)["Type"];
export type NodeDownload = (typeof NodeDownload)["Type"];
export type NodeInstaller = (typeof NodeInstaller)["Type"];
export type EnvironmentReport = (typeof EnvironmentReport)["Type"];
export type EnvironmentParams = (typeof EnvironmentParams)["Type"];
export type InstallEvent = (typeof InstallEvent)["Type"];
export type Installed = (typeof Installed)["Type"];
export type UpgradeParams = (typeof UpgradeParams)["Type"];
export type Upgraded = (typeof Upgraded)["Type"];
export type ContextUsage = (typeof ContextUsage)["Type"];
export type AgentFailureKind = (typeof AgentFailureKind)["Type"];
export type AgentFailure = (typeof AgentFailure)["Type"];
export type AgentEvent = (typeof AgentEvent)["Type"];
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

export const ExportFormat = Schema.Literals(EXPORT_FORMATS);

export const ExportQuality = Schema.Literals(EXPORT_QUALITIES);

export const ExportResolution = Schema.Literals(EXPORT_RESOLUTIONS);

export const ExportPreset = Schema.Literals(EXPORT_PRESETS);

// Everything the dialog picked. The defaults are what the button did before it
// had a dialog: H.264 into the project's own out/, at the project's settings.
export const ExportParams = Schema.Struct({
  composition: Schema.NonEmptyString,
  format: ExportFormat.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_FORMAT))
  ),
  outputPath: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  preset: ExportPreset.pipe(
    Schema.withDecodingDefault(Effect.succeed("custom" as const))
  ),
  projectId: Schema.NonEmptyString,
  quality: ExportQuality.pipe(
    Schema.withDecodingDefault(Effect.succeed("project" as const))
  ),
  resolution: ExportResolution.pipe(
    Schema.withDecodingDefault(Effect.succeed("source" as const))
  ),
});

export const ExportStage = Schema.Literals(["encoding", "muxing"]);

export const ExportJobStage = Schema.Literals([
  "preparing",
  "rendering",
  "finalizing",
]);

export const ExportEvent = Schema.Union([
  Schema.Struct({
    percent: Schema.Int,
    type: Schema.Literal("browser"),
  }),
  Schema.Struct({
    stage: ExportJobStage,
    type: Schema.Literal("stage"),
  }),
  Schema.Struct({
    message: Schema.String,
    type: Schema.Literal("notice"),
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
  height: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  path: Schema.NonEmptyString,
  width: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
});

// What the project's own `@remotion/studio-codemods` needs to find a JSX call
// site, and what it answers with. The shapes are Remotion's, mirrored here
// only as far as the studio reads them.
export const VideoConfigValues = Schema.Struct({
  durationInFrames: Schema.Int,
  fps: Schema.Finite,
  height: Schema.Int,
  width: Schema.Int,
});

// Remotion's own subscription key: the address `setPropStatuses` and
// `setDragOverrides` are given, and what the codemod hands back for a
// resolved call site. It travels whole, because the two ends of it are
// Remotion's runtime and Remotion's codemod, not us.
export const CodeNodePath = Schema.Struct({
  absolutePath: Schema.NonEmptyString,
  effectKeys: Schema.Array(Schema.Array(Schema.String)),
  nodePath: Schema.Array(Schema.Union([Schema.String, Schema.Finite])),
  sequenceKeys: Schema.Array(Schema.String),
  videoConfigValues: Schema.NullOr(VideoConfigValues),
});

export const CodeStatusKind = Schema.Literals([
  "computed",
  "keyframed",
  "static",
]);

export const CodePropStatus = Schema.Struct({
  kind: CodeStatusKind,
  // Remotion's own status object, carried unread and handed straight back to
  // its runtime. A keyframed one holds its keyframes, easing and clamping; a
  // second declaration of that shape here could only drift from the one the
  // runtime actually reads.
  status: Schema.Unknown,
});

export const CodeTarget = Schema.Struct({
  file: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  identity: Schema.NullOr(Schema.String),
  keys: Schema.Array(Schema.NonEmptyString),
  line: Schema.Int,
});

export const StatusParams = Schema.Struct({
  projectId: Schema.NonEmptyString,
  targets: Schema.Array(CodeTarget),
  video: VideoConfigValues,
});

export const CodeTargetStatus = Schema.Struct({
  id: Schema.NonEmptyString,
  nodePath: Schema.NullOr(CodeNodePath),
  props: Schema.Record(Schema.String, CodePropStatus),
  reason: Schema.NullOr(Schema.String),
});

export const StatusResult = Schema.Struct({
  targets: Schema.Array(CodeTargetStatus),
});

// `defaultValue` is always present and explicit: writing a value equal to it
// takes the attribute back off the call site, and JSON drops an `undefined`
// key, so "there is no default" travels as `null`.
export const CodePropUpdate = Schema.Struct({
  defaultValue: Schema.Unknown,
  key: Schema.NonEmptyString,
  value: TuningValue,
});

export const CodeKeyframeUpdate = Schema.Struct({
  frame: Schema.Int,
  key: Schema.NonEmptyString,
  value: TuningValue,
});

export const CodeEdit = Schema.Struct({
  file: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  keyframes: Schema.Array(CodeKeyframeUpdate),
  nodePath: CodeNodePath,
  // The target's `InteractivitySchema`, as the page read it off `controls`.
  schema: Schema.Unknown,
  updates: Schema.Array(CodePropUpdate),
});

export const WriteParams = Schema.Struct({
  edits: Schema.Array(CodeEdit),
  // Whether the successful edits may land while others failed. The first
  // attempt is always `false` — nothing is written until everything can be —
  // and only the person answering the card turns it on.
  partial: Schema.Boolean,
  projectId: Schema.NonEmptyString,
});

export const RemoveParams = Schema.Struct({
  component: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  target: CodeTarget,
  video: VideoConfigValues,
});

export const Removed = Schema.Struct({
  file: Schema.NonEmptyString,
  line: Schema.NullOr(Schema.Int),
  removal: Schema.NonEmptyString,
});

export const RestoreParams = Schema.Struct({
  projectId: Schema.NonEmptyString,
  removal: Schema.NonEmptyString,
});

export const Restored = Schema.Struct({
  file: Schema.NonEmptyString,
});

export const StudioRemoved = Schema.Struct({
  ...StudioSnapshot.fields,
  upgraded: Schema.NullOr(Schema.NonEmptyString),
});

export const CodeWritten = Schema.Struct({
  file: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  line: Schema.NullOr(Schema.Int),
  message: Schema.NullOr(Schema.String),
  ok: Schema.Boolean,
});

export const WriteResult = Schema.Struct({
  files: Schema.Array(Schema.NonEmptyString),
  results: Schema.Array(CodeWritten),
});

export const RecordedMessage = Schema.Struct({
  session: Schema.NullOr(HistorySession),
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
export type ExportJobStage = (typeof ExportJobStage)["Type"];
export type Exported = (typeof Exported)["Type"];
export type VideoConfigValues = (typeof VideoConfigValues)["Type"];
export type CodeNodePath = (typeof CodeNodePath)["Type"];
export type CodeStatusKind = (typeof CodeStatusKind)["Type"];
export type CodePropStatus = (typeof CodePropStatus)["Type"];
export type CodeTarget = (typeof CodeTarget)["Type"];
export type CodeTargetStatus = (typeof CodeTargetStatus)["Type"];
export type StatusParams = (typeof StatusParams)["Type"];
export type StatusResult = (typeof StatusResult)["Type"];
export type CodePropUpdate = (typeof CodePropUpdate)["Type"];
export type CodeKeyframeUpdate = (typeof CodeKeyframeUpdate)["Type"];
export type CodeEdit = (typeof CodeEdit)["Type"];
export type WriteParams = (typeof WriteParams)["Type"];
export type RemoveParams = (typeof RemoveParams)["Type"];
export type Removed = (typeof Removed)["Type"];
export type RestoreParams = (typeof RestoreParams)["Type"];
export type Restored = (typeof Restored)["Type"];
export type StudioRemoved = (typeof StudioRemoved)["Type"];
export type CodeWritten = (typeof CodeWritten)["Type"];
export type WriteResult = (typeof WriteResult)["Type"];
export type RecordedMessage = (typeof RecordedMessage)["Type"];

export const SIDECAR_METHODS = {
  "agent.accounts": {
    params: Schema.NullOr(Schema.Struct({ force: Schema.Boolean })),
    result: Schema.Array(EnvironmentCheck),
    stream: Schema.Never,
  },
  "agent.permission": {
    params: PermissionParams,
    result: PermissionAnswer,
    stream: Schema.Never,
  },
  "agent.prompt": {
    params: PromptParams,
    result: PromptResult,
    stream: AgentEvent,
  },
  "agent.source": {
    params: SourceAssetParams,
    result: SourceAssetAnswer,
    stream: Schema.Never,
  },
  "crash.consent": {
    params: CrashConsent,
    result: CrashReporting,
    stream: Schema.Never,
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
  "history.record": {
    params: PromptParams,
    result: RecordedMessage,
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
  "library.stockSave": {
    params: StockItem,
    result: Asset,
    stream: StockProgress,
  },
  "library.stockSearch": {
    params: StockQuery,
    result: StockPage,
    stream: Schema.Never,
  },
  "library.stockStatus": {
    params: Schema.Null,
    result: StockConfigured,
    stream: Schema.Never,
  },
  "node.install": {
    params: Schema.Null,
    result: NodeInstaller,
    stream: NodeDownload,
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
  "preview.remove": {
    params: RemoveParams,
    result: Removed,
    stream: Schema.Never,
  },
  "preview.restore": {
    params: RestoreParams,
    result: Restored,
    stream: Schema.Never,
  },
  "preview.start": {
    params: PreviewParams,
    result: PreviewResult,
    stream: PreviewEvent,
  },
  "preview.status": {
    params: StatusParams,
    result: StatusResult,
    stream: Schema.Never,
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
  "preview.write": {
    params: WriteParams,
    result: WriteResult,
    stream: Schema.Never,
  },
  "project.brandFile": {
    params: Schema.Struct({ path: Schema.String, projectId: Schema.String }),
    result: BrandFile,
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
  "project.designImport": {
    params: Schema.Struct({ path: Schema.String, projectId: Schema.String }),
    result: DesignImport,
    stream: Schema.Never,
  },
  "project.files": {
    params: ProjectRef,
    result: ProjectFiles,
    stream: Schema.Never,
  },
  "project.fromTemplate": {
    params: TemplateDraft,
    result: TemplateProject,
    stream: Schema.Never,
  },
  "project.googleFont": {
    params: Schema.Struct({
      family: Schema.String,
      italic: Schema.optionalKey(Schema.Boolean),
      projectId: Schema.String,
      weights: Schema.String,
    }),
    result: BrandFont,
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
  "project.move": {
    params: Schema.Struct({ parent: Schema.String, projectId: Schema.String }),
    result: Project,
    stream: Schema.Struct({ phase: Schema.String }),
  },
  "project.moveCancel": {
    params: ProjectRef,
    result: Schema.Null,
    stream: Schema.Never,
  },
  "project.open": {
    params: ProjectPath,
    result: Project,
    stream: Schema.Never,
  },
  "project.read": {
    params: DocumentRef,
    result: DocumentText,
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
  "project.settingsGet": {
    params: ProjectRef,
    result: ProjectConfig,
    stream: Schema.Never,
  },
  "project.settingsSave": {
    params: ProjectSettingsDraft,
    result: ProjectConfig,
    stream: Schema.Never,
  },
  "project.upgrade": {
    params: UpgradeParams,
    result: Upgraded,
    stream: InstallEvent,
  },
  "sidecar.emit": { params: EmitParams, result: EmitResult, stream: EmitChunk },
  "sidecar.info": {
    params: Schema.Null,
    result: SidecarInfo,
    stream: Schema.Never,
  },
  "studio.patch": {
    params: Schema.Struct({
      ...StudioDocumentRef.fields,
      operation: StudioOperation,
    }),
    result: StudioSnapshot,
    stream: Schema.Never,
  },
  "studio.read": {
    params: StudioDocumentRef,
    result: StudioSnapshot,
    stream: Schema.Never,
  },
  "studio.remove": {
    params: Schema.Struct({
      ...StudioDocumentRef.fields,
      operation: StudioObjectOperation,
    }),
    result: StudioRemoved,
    stream: Schema.Never,
  },
  "video.brandConfirm": {
    params: Schema.Struct({
      projectId: Schema.String,
      revision: Schema.Int,
      videoId: Schema.String,
    }),
    result: ProjectBrandSnapshot,
    stream: Schema.Never,
  },
  "video.brandStatus": {
    params: VideoRef,
    result: Schema.NullOr(ProjectBrandApplication),
    stream: Schema.Never,
  },
  "video.create": {
    params: VideoDraft,
    result: Video,
    stream: Schema.Never,
  },
  "video.documents": {
    params: VideoRef,
    result: VideoDocuments,
    stream: Schema.Never,
  },
  "video.list": {
    params: ProjectRef,
    result: Schema.Array(Video),
    stream: Schema.Never,
  },
  "video.reconcile": {
    params: VideoReconcile,
    result: Schema.Array(Video),
    stream: Schema.Never,
  },
  "video.register": {
    params: VideoRef,
    result: Video,
    stream: Schema.Never,
  },
  "video.remove": {
    params: VideoRef,
    result: VideoRemoved,
    stream: Schema.Never,
  },
  "video.rename": {
    params: VideoName,
    result: Video,
    stream: Schema.Never,
  },
  "video.restore": {
    params: VideoRef,
    result: Video,
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
  Schema.Struct({
    id: RequestId,
    method: Schema.String,
    params: Schema.Unknown,
    type: Schema.Literal("request"),
  }),
]);

export type SidecarFrame = (typeof SidecarFrame)["Type"];

export type CoreRequestFrame = Extract<SidecarFrame, { type: "request" }>;

export type CoreResultFrame = Extract<HostFrame, { type: "result" }>;

export type CoreFailureFrame = Extract<HostFrame, { type: "error" }>;

export type CoreAnswerFrame = CoreResultFrame | CoreFailureFrame;

export const CORE_METHOD_NAMES = [
  "integrations.usable",
  "sounds.prepare",
  "sounds.commit",
  "sounds.status",
  "sounds.cancel",
  "sounds.recover",
  "sounds.imported",
] as const;

export type CoreMethod = (typeof CORE_METHOD_NAMES)[number];

export const CORE_METHODS = {
  "integrations.usable": {
    params: Schema.Null,
    result: Connections,
  },
  "sounds.cancel": { params: SoundRef, result: SoundOperation },
  "sounds.commit": { params: SoundRef, result: SoundOperation },
  "sounds.imported": { params: SoundRef, result: SoundOperation },
  "sounds.prepare": { params: AudioRequest, result: SoundOperation },
  "sounds.recover": {
    params: Schema.Null,
    result: Schema.Array(SoundOperation),
  },
  "sounds.status": { params: SoundRef, result: SoundOperation },
} as const;

export type CoreParams<M extends CoreMethod> =
  (typeof CORE_METHODS)[M]["params"]["Type"];

export type CoreResult<M extends CoreMethod> =
  (typeof CORE_METHODS)[M]["result"]["Type"];

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
  os: Schema.String,
  // False for a Linux build installed some other way than a release's
  // AppImage, .deb or .rpm, which the updater cannot replace.
  updatesInPlace: Schema.Boolean,
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

export interface CoreCodecs<M extends CoreMethod> {
  params: Decoder<CoreParams<M>>;
  result: Decoder<CoreResult<M>>;
}

const CORE_CODECS = Object.fromEntries(
  CORE_METHOD_NAMES.map((method) => [
    method,
    {
      params: Schema.decodeUnknownExit(CORE_METHODS[method].params),
      result: Schema.decodeUnknownExit(CORE_METHODS[method].result),
    },
  ])
) as { [M in CoreMethod]: CoreCodecs<M> };

export function coreCodecsFor<M extends CoreMethod>(method: M): CoreCodecs<M> {
  return CORE_CODECS[method];
}

export const decodeCoreMethod: Decoder<CoreMethod> = Schema.decodeUnknownExit(
  Schema.Literals(CORE_METHOD_NAMES)
);
