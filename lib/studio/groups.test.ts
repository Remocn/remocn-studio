import { describe, expect, it } from "vitest";
import { groupSessions } from "@/lib/studio/groups";
import type { HistorySession, Project } from "@/shared/ipc";

const project = (id: string): Project => ({
  createdAt: 0,
  id,
  missing: false,
  name: id,
  path: `/videos/${id}`,
  updatedAt: 0,
});

const session = (id: string, projectId: string): HistorySession => ({
  createdAt: 0,
  id,
  mode: "auto",
  projectId,
  sdkSessionId: null,
  title: id,
  updatedAt: 0,
});

describe("groupSessions", () => {
  it("keeps the order it is given, projects and sessions alike", () => {
    const groups = groupSessions(
      [project("promo"), project("teaser")],
      [
        session("newest", "teaser"),
        session("older", "promo"),
        session("oldest", "promo"),
      ]
    );

    expect(groups.map((group) => group.project.id)).toEqual([
      "promo",
      "teaser",
    ]);
    expect(groups[0].sessions.map((row) => row.id)).toEqual([
      "older",
      "oldest",
    ]);
    expect(groups[1].sessions.map((row) => row.id)).toEqual(["newest"]);
  });

  it("gives a project with no sessions an empty group", () => {
    const groups = groupSessions([project("promo")], []);

    expect(groups).toEqual([{ project: project("promo"), sessions: [] }]);
  });

  it("drops a session whose project is not listed", () => {
    const groups = groupSessions(
      [project("promo")],
      [session("stray", "removed")]
    );

    expect(groups[0].sessions).toEqual([]);
  });
});
