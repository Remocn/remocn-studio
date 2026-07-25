import type {
  ContextUsage,
  PermissionReason,
  TranscriptEntry,
} from "@/shared/ipc";

export type SessionStatus = "failed" | "idle" | "running" | "waiting";

export interface PendingPermission {
  id: string;
  input: unknown;
  name: string;
  reason: PermissionReason;
}

export interface TurnState {
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isLoading: boolean;
  isRunning: boolean;
  permissions: readonly PendingPermission[];
  sdkSessionId: string | null;
  unread: boolean;
}

export const IDLE_TURN: TurnState = {
  context: null,
  entries: [],
  error: null,
  isLoading: false,
  isRunning: false,
  permissions: [],
  sdkSessionId: null,
  unread: false,
};

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
