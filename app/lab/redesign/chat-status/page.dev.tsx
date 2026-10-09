"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";
import { SessionItem } from "@/components/studio/session-item";
import { Button } from "@/components/ui/button";
import type { SessionRow } from "@/lib/studio/groups";

const STATES = [
  ["Opening scene", "running", false],
  ["Adjust typography", "idle", true],
  ["Soundtrack", "failed", false],
  ["Review permissions", "waiting", false],
  ["New chat", "idle", false],
] as const;
const noop = () => undefined;
const ROWS: SessionRow[] = STATES.map(([title, status, completed], index) => ({
  askedAt: null,
  completed,
  error: status === "failed" ? "Generation failed" : null,
  progress: null,
  session: {
    createdAt: 0,
    id: `chat-${index}`,
    mode: "auto",
    projectId: "project-1",
    provider: "claude",
    sdkSessionId: null,
    title,
    updatedAt: 0,
    videoId: "video-1",
  },
  startedAt: null,
  status,
  task: null,
  tool: null,
  unread: false,
}));

export default function ChatStatusFixture() {
  const { setTheme } = useTheme();
  const dark = useCallback(() => setTheme("dark"), [setTheme]);
  const light = useCallback(() => setTheme("light"), [setTheme]);
  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 bg-background p-8 text-foreground">
      <div className="flex gap-2">
        <Button onClick={dark}>Dark</Button>
        <Button onClick={light}>Light</Button>
      </div>
      <aside
        aria-label="Recent chats"
        className="w-[238px] rounded-xl bg-sidebar p-3"
      >
        <h1 className="px-2 py-2 text-muted-foreground text-xs">
          Recent chats
        </h1>
        {ROWS.map((row) => (
          <SessionItem
            compact
            isActive={false}
            key={row.session.id}
            now={0}
            onRemove={noop}
            onSelect={noop}
            row={row}
          />
        ))}
      </aside>
    </main>
  );
}
