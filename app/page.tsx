"use client";

import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Placeholder shell. The real three-pane layout (sessions | chat | preview)
// lands in #219; this page exists to prove the Next static export boots inside
// the Tauri webview and that IPC to the Rust core round-trips.
export default function Page() {
  const [pong, setPong] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ping() {
    setError(null);
    try {
      setPong(await invoke<string>("greet", { name: "studio" }));
    } catch (cause) {
      setPong(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="space-y-1 text-center">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">
          remocn studio
        </h1>
        <p className="text-muted-foreground text-sm">
          Next.js static export running in the Tauri webview.
        </p>
      </div>

      <Button onClick={ping}>Ping the Rust core</Button>

      {pong ? (
        <p className="font-mono text-muted-foreground text-xs" data-selectable>
          {pong}
        </p>
      ) : null}
      {error ? (
        <p className="font-mono text-destructive text-xs" data-selectable>
          IPC failed: {error}
        </p>
      ) : null}
    </main>
  );
}
