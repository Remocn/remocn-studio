import type { HistorySession, Project } from "@/shared/ipc";

export interface ProjectGroup {
  readonly project: Project;
  readonly sessions: readonly HistorySession[];
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
