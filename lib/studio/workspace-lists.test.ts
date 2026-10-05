import { expect, it } from "bun:test";
import type { HistorySession, Project } from "@/shared/ipc";
import { recentProjects } from "./workspace-lists";

it("orders projects by their newest chat, with project dates only for empty projects", () => {
  const project = (id: string, updatedAt: number): Project => ({
    createdAt: 0,
    id,
    missing: false,
    name: id,
    path: `/projects/${id}`,
    updatedAt,
  });
  const chat = (projectId: string, updatedAt: number): HistorySession => ({
    createdAt: 0,
    id: `${projectId}-${updatedAt}`,
    mode: "auto",
    projectId,
    provider: "claude",
    sdkSessionId: null,
    title: "Chat",
    updatedAt,
    videoId: "video",
  });
  const projects = [
    project("old", 999),
    project("empty", 20),
    project("active", 1),
  ];
  const sessions = [chat("active", 30), chat("old", 10), chat("active", 5)];
  expect(recentProjects(projects, sessions).map((row) => row.id)).toEqual([
    "active",
    "empty",
    "old",
  ]);
  expect(projects.map((row) => row.id)).toEqual(["old", "empty", "active"]);
});
