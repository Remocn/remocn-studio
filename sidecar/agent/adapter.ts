import type { Effect } from "effect";
import type {
  AgentEvent,
  EnvironmentCheck,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";
import type { ProviderInfo } from "@/shared/providers";
import type { Ask } from "../tools/execute";
import type { StdioTransport } from "../tools/gateway";
import type { ToolServer } from "../tools/specs";
import type { TurnGate } from "./gate";
import type { TurnInstructions } from "./instructions";
import type { ApplyMode } from "./mode";

// Everything a turn needs from the app, in provider-neutral terms: the gate
// and the mode switch are pure Effect, and the studio's tools arrive as
// stdio-MCP transports every CLI can spawn — the implementations stay behind
// the gateway in the sidecar. `emit` is the raw stream; `record` is the
// history write, kept separate because a permission ask rides the stream but
// must not land in the transcript.
export interface TurnServices {
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly inProcess?: Readonly<Partial<Record<ToolServer, Ask>>>;
  readonly instructions: (hasSkills: boolean) => TurnInstructions;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly onMode: (apply: ApplyMode) => Effect.Effect<void>;
  readonly permissions: TurnGate;
  readonly record: (event: AgentEvent) => Effect.Effect<void>;
  // Keyed by server, and a Free turn is served fewer of them: the pipeline
  // is Pro, so its key is simply absent rather than pointing at a refusal.
  readonly tools: Readonly<Partial<Record<ToolServer, StdioTransport>>>;
  readonly turnId: string;
}

export interface ToolKeyIds {
  readonly chat: string;
  readonly turn: string;
}

// A turn never fails as an Effect: every way it can go wrong is folded into
// `failure` so the words reach the UI. Cancellation is fiber interruption,
// which each adapter turns into whatever its runtime calls a stop.
export interface AgentAdapter {
  readonly account: (cwd: string) => Effect.Effect<EnvironmentCheck>;
  readonly forget: (chat: string) => Effect.Effect<void>;
  readonly info: ProviderInfo;
  readonly toolKey: (ids: ToolKeyIds) => string;
  readonly turn: (
    params: PromptParams,
    services: TurnServices
  ) => Effect.Effect<PromptResult>;
}
