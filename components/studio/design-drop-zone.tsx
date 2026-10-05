"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { isInside } from "@/lib/studio/drop";
import { watchFileDrops } from "@/lib/studio/shell";
import { SettingsGroup } from "./settings-group";

export function DesignDropZone({
  filename,
  compact = false,
  loading,
  onChoose,
  onDrop,
  onError,
}: {
  filename?: string;
  compact?: boolean;
  loading: boolean;
  onChoose: () => void;
  onDrop: (path: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  const held = useRef({ loading, onDrop, onError });
  held.current = { loading, onDrop, onError };
  useEffect(() => {
    const inside = (position: { x: number; y: number } | null) =>
      !(held.current.loading || ref.current?.matches(":disabled")) &&
      isInside(ref.current?.getBoundingClientRect() ?? null, position);
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchFileDrops({
            onDrop: ({ paths, position }) => {
              setOver(false);
              if (!inside(position)) {
                return;
              }
              if (
                paths.length !== 1 ||
                !paths[0].toLowerCase().endsWith(".md")
              ) {
                held.current.onError("Drop one Markdown (.md) file.");
                return;
              }
              held.current.onDrop(paths[0]);
            },
            onOver: (position) => setOver(inside(position)),
          });
          yield* Effect.never;
        })
      ).pipe(Effect.catch(() => Effect.void))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          aria-busy={loading}
          aria-label="Import DESIGN.md"
          className="data-[over=true]:bg-accent"
          data-over={over}
          disabled={loading}
          onClick={onChoose}
          ref={ref}
          size="sm"
          type="button"
          variant="secondary"
        >
          {loading ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <UploadIcon />
          )}
          {loading ? "Reading…" : "Import brand"}
        </Button>
        {filename ? (
          <span className="break-all text-muted-foreground text-xs">
            {filename}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <SettingsGroup
      description="Bring your colors, typography and design guidelines from DESIGN.md."
      title="Design reference"
    >
      <div>
        <button
          aria-busy={loading}
          aria-label="Import DESIGN.md"
          className="group flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-card px-5 py-6 text-center transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-64 data-[over=true]:bg-accent motion-reduce:transition-none"
          data-over={over}
          disabled={loading}
          onClick={onChoose}
          ref={ref}
          type="button"
        >
          {loading ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="pointer-events-none size-5 animate-spin"
            />
          ) : null}
          <span
            className="pointer-events-none grid max-w-full gap-2"
            role="status"
          >
            <span className="break-all font-medium text-[14px] leading-5">
              {dropTitle(loading, over, filename)}
            </span>
            <span className="text-muted-foreground text-sm">
              {filename
                ? "Drop a new file or click to replace"
                : "or click anywhere here to choose a file"}
            </span>
          </span>
          <span className="pointer-events-none text-muted-foreground text-xs">
            Markdown · up to 256 KB
          </span>
        </button>
      </div>
    </SettingsGroup>
  );
}
function dropTitle(loading: boolean, over: boolean, filename?: string) {
  if (loading) {
    return "Reading design reference…";
  }
  if (over) {
    return "Drop DESIGN.md here";
  }
  return filename ?? "Drop your DESIGN.md here";
}
