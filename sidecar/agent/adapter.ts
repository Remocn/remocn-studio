import type { Effect } from "effect";
import type {
  AgentEvent,
  EnvironmentCheck,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { Asset, AssetDraft } from "@/shared/library";
import type {
  PipelineStage,
  PipelineStageId,
  PipelineStatus,
} from "@/shared/pipeline";
import type { ProviderInfo } from "@/shared/providers";
import type { PermissionGate } from "./gate";
import type { ApplyMode } from "./mode";

export interface TurnBriefs {
  readonly assets: string | null;
  readonly media: string | null;
  readonly pipeline: string | null;
}

export interface LibraryCalls {
  readonly list: () => Promise<readonly Asset[]>;
  readonly save: (draft: AssetDraft) => Promise<Asset>;
}

export interface PipelineCalls {
  readonly setStage: (
    stage: PipelineStageId,
    status: PipelineStatus
  ) => Promise<readonly PipelineStage[]>;
  readonly start: () => Promise<readonly PipelineStage[]>;
}

// Everything a turn needs from the app, in provider-neutral terms: the gate
// and the mode switch are pure Effect, the library and pipeline calls are the
// tool *implementations* — how they reach the agent (in-process MCP, stdio
// MCP, instructions) is each adapter's own business. `emit` is the raw stream;
// `record` is the history write, kept separate because a permission ask rides
// the stream but must not land in the transcript.
export interface TurnServices {
  readonly briefs: TurnBriefs;
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly library: LibraryCalls;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly onApprove: (mode: SessionMode) => Effect.Effect<void>;
  readonly onMode: (apply: ApplyMode) => Effect.Effect<void>;
  readonly pipeline: PipelineCalls;
  readonly record: (event: AgentEvent) => Effect.Effect<void>;
  readonly turnId: string;
}

// A turn never fails as an Effect: every way it can go wrong is folded into
// `failure` so the words reach the UI. Cancellation is fiber interruption,
// which each adapter turns into whatever its runtime calls a stop.
export interface AgentAdapter {
  readonly account: (cwd: string) => Effect.Effect<EnvironmentCheck>;
  readonly info: ProviderInfo;
  readonly turn: (
    params: PromptParams,
    services: TurnServices
  ) => Effect.Effect<PromptResult>;
}
