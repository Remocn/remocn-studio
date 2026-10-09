"use client";

import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/studio/export-button";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useExport } from "@/hooks/use-export";
import type { ExportEvent, Exported } from "@/shared/ipc";

interface MockRender {
  complete: () => void;
  fail: () => void;
  progress: () => void;
}

function mockRender(): MockRender {
  const store = new Map<string, unknown>();
  let finish: ((result: Exported) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  let stream = 0;
  let index = 0;
  const send = (event: ExportEvent) => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: {
          runCallback: (id: number, data: unknown) => void;
        };
      }
    ).__TAURI_INTERNALS__;
    internals.runCallback(stream, { index, message: event });
    index += 1;
  };
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
        case "plugin:store|save":
        case "plugin:opener|reveal_item_in_dir":
        case "sidecar_cancel":
          return null;
        case "path_exists":
          return false;
        case "plugin:dialog|open":
          return "/fixture/exports";
        case "sidecar_request":
          if (args.method !== "preview.export") {
            throw new Error(
              `Unexpected fixture method: ${String(args.method)}`
            );
          }
          stream = (args.onStream as { id: number }).id;
          index = 0;
          return new Promise<Exported>((resolve, reject) => {
            finish = resolve;
            fail = reject;
          });
        default:
          throw new Error(`Unexpected fixture command: ${command}`);
      }
    },
    { shouldMockEvents: true }
  );
  return {
    complete: () =>
      finish?.({
        bytes: 4_404_019,
        height: 1080,
        path: "/fixture/exports/Launch film.mp4",
        width: 1920,
      }),
    fail: () => fail?.(new Error("The renderer could not encode this frame.")),
    progress: () => send({ percent: 50, type: "browser" }),
  };
}

const METADATA = { durationInFrames: 300, fps: 30, height: 1080, width: 1920 };

function ExportFixture({ host }: { host: MockRender }) {
  const theme = useTheme();
  const toggleTheme = useCallback(
    () => theme.setTheme(theme.resolvedTheme === "dark" ? "light" : "dark"),
    [theme.setTheme, theme.resolvedTheme]
  );
  const exporting = useExport({
    composition: "Launch film",
    isServing: true,
    metadata: METADATA,
    openedProjectId: "export-fixture",
    projectId: "export-fixture",
    projectPath: "/fixture",
  });
  return (
    <TooltipProvider>
      <main className="flex min-h-dvh flex-col gap-6 bg-background p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-medium text-sm">Export · browser fixture</h1>
          <Button onClick={toggleTheme} size="sm" variant="secondary">
            Toggle theme
          </Button>
        </div>
        <p className="max-w-xl text-muted-foreground text-xs">
          Uses the real export hook and controls with in-memory IPC. No video is
          rendered and no files are written.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ExportButton composition="Launch film" exporting={exporting} />
          {exporting.isRunning ? (
            <>
              <Button onClick={host.progress} size="sm" variant="secondary">
                Show progress
              </Button>
              <Button onClick={host.complete} size="sm" variant="secondary">
                Complete render
              </Button>
              <Button onClick={host.fail} size="sm" variant="secondary">
                Fail render
              </Button>
            </>
          ) : null}
          {exporting.canRetry ? (
            <Button onClick={exporting.retry} size="sm" variant="secondary">
              Retry render
            </Button>
          ) : null}
        </div>
        <output
          aria-label="Export state"
          className="text-muted-foreground text-sm"
        >
          {exporting.status ??
            exporting.trouble ??
            exporting.result?.path ??
            "Ready"}
        </output>
      </main>
    </TooltipProvider>
  );
}

export default function ExportPage() {
  const [host, setHost] = useState<MockRender | null>(null);
  useEffect(() => {
    setHost(mockRender());
    return clearMocks;
  }, []);
  return host === null ? null : <ExportFixture host={host} />;
}
