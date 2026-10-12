"use client";

import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/studio/app-shell";
import { emptyBrand } from "@/shared/brand";
import type { Connection } from "@/shared/integrations";
import type { HistorySession, Project, Video } from "@/shared/ipc";
import type { ProjectConfig } from "@/shared/project-config";
import { LIBRARY_ASSETS } from "./assets";
import { TRANSCRIPTS } from "./transcripts";

const PROJECTS: Project[] = ["Product launch", "Brand film", "Social cut"].map(
  (name, index) => ({
    createdAt: 1_700_000_000_000,
    id: `project-${index + 1}`,
    missing: false,
    name,
    path: `/Movies/Remocn/${name}`,
    updatedAt: 1_700_000_000_000,
  })
);
const VIDEOS: Video[] = ["Launch film", "Product demo"].map((name, index) => ({
  compositionId: `video-${index + 1}`,
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: `video-${index + 1}`,
  missing: false,
  name,
  projectId: PROJECTS[0].id,
  updatedAt: 1_700_000_000_000,
}));
const SESSIONS: HistorySession[] = [
  "Opening scene",
  "Adjust typography",
  "Soundtrack",
  "Color study",
  "Opening titles",
  "End card",
  "Transitions",
  "Narration",
  "Final review",
].map((title, index) => ({
  createdAt: 1_700_000_000_000,
  id: `session-${index + 1}`,
  mode: "auto",
  projectId: PROJECTS[0].id,
  provider: "claude",
  sdkSessionId: null,
  title,
  updatedAt: 1_700_000_000_000 - index,
  videoId: VIDEOS[0].id,
}));

VIDEOS.push({
  ...VIDEOS[0],
  compositionId: "brand-video",
  id: "brand-video",
  name: "Brand story",
  projectId: PROJECTS[1].id,
});
SESSIONS.push(
  ...["Brand story", "Logo motion"].map((title, index) => ({
    ...SESSIONS[0],
    id: `brand-session-${index}`,
    projectId: PROJECTS[1].id,
    title,
    videoId: "brand-video",
  }))
);

function mockStudio() {
  let connections: Connection[] = [
    {
      account: "studio@remocn.dev",
      capabilities: ["audio"],
      detail: null,
      disabled: false,
      id: "connection-1",
      name: "Product launch",
      provider: "elevenlabs",
      state: "connected",
    },
  ];
  const store = new Map<string, unknown>([
    ["onboarding", JSON.stringify({ chapter: "inspect", dismissed: true })],
    ["previewPane", "hidden"],
  ]);
  let config: ProjectConfig = {
    brand: {
      ...emptyBrand(),
      colors: {
        accent: "#B339A1",
        background: "#FFFFFF",
        foreground: "#191919",
      },
      name: "Remocn Studio",
      typography: {
        body: {
          fallback: "sans-serif",
          family: "Inter",
          files: [],
          licenses: [],
        },
        display: {
          fallback: "sans-serif",
          family: "Inter",
          files: [],
          licenses: [],
        },
        mono: {
          fallback: "monospace",
          family: "Geist Mono",
          files: [],
          licenses: [],
        },
      },
    },
    name: PROJECTS[0].name,
    projectId: PROJECTS[0].id,
    revision: 1,
    schemaVersion: 1,
  };
  function request(args: Record<string, unknown>) {
    const params = (args.params ?? {}) as Record<string, unknown>;
    switch (args.method) {
      case "agent.accounts":
        return [
          {
            detail: "Pro",
            fix: null,
            id: "claude",
            state: "ok",
            title: "Claude Code is logged in",
          },
          {
            detail: null,
            fix: null,
            id: "codex",
            state: "ok",
            title: "Codex is logged in",
          },
          {
            detail: null,
            fix: { step: "signin", type: "provider" },
            id: "copilot",
            state: "failed",
            title: "Sign in to GitHub Copilot",
          },
          {
            detail: null,
            fix: { step: "install", type: "provider" },
            id: "grok",
            state: "failed",
            title: "Grok Build is not installed",
          },
        ];
      case "project.list":
        return PROJECTS;
      case "project.open":
        return PROJECTS[0];
      case "project.settingsGet":
        return config;
      case "project.settingsSave": {
        config = {
          ...config,
          brand: params.brand as ProjectConfig["brand"],
          name: String(params.name),
          revision: config.revision + 1,
        };
        return config;
      }
      case "project.designImport":
        return {
          colors: {
            accent: "#B339A1",
            background: "#111111",
            foreground: "#F7F7F7",
          },
          document: {
            file: {
              hash: "a".repeat(64),
              path: "public/brand/DESIGN.md",
              source: "DESIGN.md",
            },
            markdown: "# Studio launch\nA clear, compact visual language.",
          },
          fonts: [
            { family: "Inter", token: "heading", weight: "500" },
            { family: "Inter", token: "body", weight: "400" },
            { family: "Geist Mono", token: "code", weight: "400" },
          ],
          name: "Studio launch",
          warnings: [],
        };
      case "video.list":
      case "video.reconcile":
        return VIDEOS.filter((video) => video.projectId === params.projectId);
      case "history.sessions":
        return SESSIONS;
      case "history.blocks":
        return TRANSCRIPTS[String(params.sessionId)] ?? [];
      case "pipeline.get":
        return { sessionId: params.sessionId, stages: [] };
      case "library.list":
        return LIBRARY_ASSETS;
      case "video.brandStatus":
        return null;
      case "video.documents":
        return { files: [], folder: "/fixture/docs" };
      case "project.check":
        return { checks: [] };
      case "preview.start":
        return new Promise(() => undefined);
      default:
        throw new Error(`Unimplemented visual fixture: ${String(args.method)}`);
    }
  }
  mockIPC(
    (command, payload) => {
      const args = (payload ?? {}) as Record<string, unknown>;
      switch (command) {
        case "plugin:store|load":
          return 1;
        case "plugin:store|entries":
          return [...store];
        case "plugin:store|get":
          return [store.get(String(args.key)), store.has(String(args.key))];
        case "plugin:store|set":
          store.set(String(args.key), args.value);
          return null;
        case "plugin:dialog|open":
          return "/fixture/DESIGN.md";
        case "integrations_catalogue":
          return [
            {
              authorization: ["api-key"],
              capabilities: ["audio"],
              id: "elevenlabs",
              name: "ElevenLabs",
            },
          ];
        case "integrations_list":
          return connections;
        case "integrations_remove":
          connections = connections.filter(
            (connection) => connection.id !== args.id
          );
          return { detail: null, withdrawn: true };
        case "studio_build":
          return { environment: "development", os: "15.5", version: "1.0.1" };
        case "sidecar_status":
          return {
            attempt: 0,
            detail: null,
            logPath: "/fixture/sidecar.log",
            phase: "ready",
            pid: 1,
          };
        case "sidecar_request":
          return request(args);
        default:
          return null;
      }
    },
    { shouldMockEvents: true }
  );
}

export default function RedesignPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mockStudio();
    setReady(true);
    return clearMocks;
  }, []);
  return ready ? <AppShell /> : null;
}
