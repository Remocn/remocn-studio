import {
  type ContextUsage,
  DEFAULT_SESSION_MODE,
  type EffortLevel,
  type PermissionReason,
  type PromptAttachment,
  type PromptElement,
  type PromptFrame,
  type PromptMedia,
  type SessionMode,
  type TranscriptEntry,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";
import type { ReferenceCounts } from "@/shared/references";

export type SessionStatus = "failed" | "idle" | "running" | "waiting";

export interface PendingPermission {
  askedAt: number;
  id: string;
  input: unknown;
  name: string;
  reason: PermissionReason;
}

export interface QueuedMessage {
  assets: readonly PromptAsset[];
  attachments: readonly PromptAttachment[];
  effort: EffortLevel | null;
  elements: readonly PromptElement[];
  id: string;
  media: readonly PromptMedia[];
  model: string | null;
  playing: PromptFrame | null;
  projectId: string;
  text: string;
}

export interface TurnState {
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isLoading: boolean;
  isRunning: boolean;
  mode: SessionMode;
  permissions: readonly PendingPermission[];
  queue: readonly QueuedMessage[];
  sdkSessionId: string | null;
  startedAt: number | null;
  unread: boolean;
}

export const IDLE_TURN: TurnState = {
  context: null,
  entries: [],
  error: null,
  isLoading: false,
  isRunning: false,
  mode: DEFAULT_SESSION_MODE,
  permissions: [],
  queue: [],
  sdkSessionId: null,
  startedAt: null,
  unread: false,
};

export function enqueue(turn: TurnState, message: QueuedMessage): TurnState {
  return { ...turn, queue: [...turn.queue, message] };
}

export function dropQueued(turn: TurnState, id: string): TurnState {
  const queue = turn.queue.filter((message) => message.id !== id);
  return queue.length === turn.queue.length ? turn : { ...turn, queue };
}

export function nextQueued(
  turn: TurnState,
  hasFailed: boolean
): QueuedMessage | null {
  if (hasFailed || turn.permissions.length > 0) {
    return null;
  }
  return turn.queue[0] ?? null;
}

export function queuedCounts(message: QueuedMessage): ReferenceCounts {
  return {
    asset: message.assets.length,
    element: message.elements.length,
    image: message.attachments.length,
  };
}

export function queuedLabel(message: QueuedMessage): string {
  const text = message.text.trim();
  if (text.length > 0) {
    return text;
  }

  const carried =
    message.attachments.length +
    message.elements.length +
    message.assets.length +
    message.media.length;

  return carried === 1 ? "1 attachment" : `${carried} attachments`;
}

export function statusOf(turn: TurnState | undefined): SessionStatus {
  if (turn === undefined) {
    return "idle";
  }
  if (turn.permissions.length > 0) {
    return "waiting";
  }
  if (turn.isRunning) {
    return "running";
  }
  return turn.error === null ? "idle" : "failed";
}
