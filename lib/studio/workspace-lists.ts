import type { HistorySession, Project } from "@/shared/ipc";

export function recentProjects(
  projects: readonly Project[],
  sessions: readonly HistorySession[]
): readonly Project[] {
  const updated = new Map<string, number>();
  for (const session of sessions) {
    updated.set(
      session.projectId,
      Math.max(updated.get(session.projectId) ?? 0, session.updatedAt)
    );
  }
  const activity = (project: Project) =>
    updated.get(project.id) ?? project.updatedAt;
  return projects.toSorted((a, b) => activity(b) - activity(a));
}
