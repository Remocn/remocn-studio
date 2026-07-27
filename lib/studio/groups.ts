import type { HistorySession, Project } from "@/shared/ipc";

export interface ProjectGroup {
  readonly project: Project;
  readonly sessions: readonly HistorySession[];
}

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

export function groupSessions(
  projects: readonly Project[],
  sessions: readonly HistorySession[]
): readonly ProjectGroup[] {
  const byProject = new Map<string, HistorySession[]>();

  for (const session of sessions) {
    const kept = byProject.get(session.projectId);
    if (kept === undefined) {
      byProject.set(session.projectId, [session]);
    } else {
      kept.push(session);
    }
  }

  return projects.map((project) => ({
    project,
    sessions: byProject.get(project.id) ?? [],
  }));
}
