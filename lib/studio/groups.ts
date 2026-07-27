import { elapsedTime } from "@/lib/studio/time";
import {
  IDLE_TURN,
  type SessionStatus,
  statusOf,
  type TurnState,
} from "@/lib/studio/turns";
import type { HistorySession, Project } from "@/shared/ipc";

export const SESSION_LIMIT = 8;

export type RollupStatus = "failed" | "running" | "unread" | "waiting";

export interface SessionRow {
  readonly askedAt: number | null;
  readonly error: string | null;
  readonly session: HistorySession;
  readonly startedAt: number | null;
  readonly status: SessionStatus;
  readonly tool: string | null;
  readonly unread: boolean;
}

export interface Rollup {
  readonly count: number;
  readonly status: RollupStatus;
}

export interface PaneGroup {
  readonly hidden: number;
  readonly project: Project;
  readonly rollup: Rollup | null;
  readonly rows: readonly SessionRow[];
  readonly visible: readonly SessionRow[];
}

export interface SessionMeta {
  readonly isError: boolean;
  readonly text: string;
}

const ROLLUP_ORDER: readonly RollupStatus[] = [
  "waiting",
  "running",
  "failed",
  "unread",
];

export function projectOf(
  projects: readonly Project[],
  session: HistorySession | null,
  fallback: Project | null
): Project | null {
  if (session === null) {
    return fallback;
  }

  return projects.find((row) => row.id === session.projectId) ?? fallback;
}

export function paneGroups(
  projects: readonly Project[],
  sessions: readonly HistorySession[],
  turns: ReadonlyMap<string, TurnState>,
  limit: number = SESSION_LIMIT
): readonly PaneGroup[] {
  const byProject = new Map<string, SessionRow[]>();

  for (const session of sessions) {
    const row = rowOf(session, turns.get(session.id));
    const kept = byProject.get(session.projectId);
    if (kept === undefined) {
      byProject.set(session.projectId, [row]);
    } else {
      kept.push(row);
    }
  }

  const groups = projects.map((project) => {
    const rows = ordered(byProject.get(project.id) ?? []);
    const visible = capped(rows, limit);

    return {
      hidden: rows.length - visible.length,
      project,
      rollup: rollupOf(rows),
      rows,
      visible,
    };
  });

  return promoted(groups);
}

export function sessionMeta(row: SessionRow, now: number): SessionMeta | null {
  if (row.status === "waiting") {
    const parts = [
      row.askedAt === null
        ? "Waiting"
        : `Waiting ${elapsedTime(row.askedAt, now)}`,
      row.tool,
    ];
    return { isError: false, text: parts.filter(Boolean).join(" · ") };
  }

  if (row.status === "running") {
    return {
      isError: false,
      text:
        row.startedAt === null
          ? "Running"
          : `Running · ${elapsedTime(row.startedAt, now)}`,
    };
  }

  if (row.status === "failed" && row.error !== null) {
    return { isError: true, text: firstLine(row.error) };
  }

  return null;
}

export function isQuiet(row: SessionRow): boolean {
  return row.status !== "waiting" && row.status !== "running" && !row.unread;
}

function rowOf(
  session: HistorySession,
  turn: TurnState | undefined
): SessionRow {
  const state = turn ?? IDLE_TURN;
  const [ask] = state.permissions;

  return {
    askedAt: ask?.askedAt ?? null,
    error: state.error,
    session,
    startedAt: state.startedAt,
    status: statusOf(state),
    tool: ask?.name ?? null,
    unread: state.unread,
  };
}

function rank(row: SessionRow): number {
  if (row.status === "waiting") {
    return 0;
  }
  return row.status === "running" ? 1 : 2;
}

function ordered(rows: readonly SessionRow[]): readonly SessionRow[] {
  return [...rows].sort((left, right) => {
    const byRank = rank(left) - rank(right);
    if (byRank !== 0) {
      return byRank;
    }
    if (left.status !== "waiting" || right.status !== "waiting") {
      return 0;
    }
    return (
      (left.askedAt ?? Number.POSITIVE_INFINITY) -
      (right.askedAt ?? Number.POSITIVE_INFINITY)
    );
  });
}

function capped(
  rows: readonly SessionRow[],
  limit: number
): readonly SessionRow[] {
  let quiet = 0;

  return rows.filter((row) => {
    if (!isQuiet(row)) {
      return true;
    }
    quiet += 1;
    return quiet <= limit;
  });
}

function counts(row: SessionRow, status: RollupStatus): boolean {
  return status === "unread" ? row.unread : row.status === status;
}

function rollupOf(rows: readonly SessionRow[]): Rollup | null {
  for (const status of ROLLUP_ORDER) {
    const count = rows.filter((row) => counts(row, status)).length;
    if (count > 0) {
      return { count, status };
    }
  }

  return null;
}

function promoted(groups: readonly PaneGroup[]): readonly PaneGroup[] {
  const waits = (group: PaneGroup) => group.rollup?.status === "waiting";

  return [...groups.filter(waits), ...groups.filter((group) => !waits(group))];
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim().length > 0) ?? text;
}
