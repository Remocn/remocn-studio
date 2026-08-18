import type { Effect } from "effect";
import type {
  AgentEvent,
  EnvironmentCheck,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { ProviderInfo } from "@/shared/providers";
import type { StdioTransport } from "../tools/gateway";
import type { ToolServer } from "../tools/specs";
import type { PermissionGate } from "./gate";
import type { ApplyMode } from "./mode";

export interface TurnBriefs {
  readonly assets: string | null;
  readonly media: string | null;
  readonly pipeline: string | null;
}

// Everything a turn needs from the app, in provider-neutral terms: the gate
// and the mode switch are pure Effect, and the studio's tools arrive as
// stdio-MCP transports every CLI can spawn — the implementations stay behind
// the gateway in the sidecar. `emit` is the raw stream; `record` is the
// history write, kept separate because a permission ask rides the stream but
// must not land in the transcript.
export interface TurnServices {
  readonly briefs: TurnBriefs;
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly onApprove: (mode: SessionMode) => Effect.Effect<void>;
  readonly onMode: (apply: ApplyMode) => Effect.Effect<void>;
  readonly record: (event: AgentEvent) => Effect.Effect<void>;
  readonly tools: Readonly<Record<ToolServer, StdioTransport>>;
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
