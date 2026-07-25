"use client";

import { PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidecarEmitter } from "@/hooks/use-sidecar-emitter";

export function SidecarStreamTest({ disabled }: { disabled: boolean }) {
  const { cancel, error, isRunning, start, tokens } = useSidecarEmitter();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-xs">Stream test</h3>
        {isRunning ? (
          <Button onClick={cancel} size="xs" variant="ghost">
            <SquareIcon data-icon="inline-start" />
            Cancel
          </Button>
        ) : (
          <Button
            disabled={disabled}
            onClick={start}
            size="xs"
            variant="outline"
          >
            <PlayIcon data-icon="inline-start" />
            Run
          </Button>
        )}
      </div>

      <output
        className="min-h-9 rounded-xl bg-muted/40 px-2.5 py-1.5 font-mono text-xs leading-relaxed"
        data-slot="sidecar-stream"
      >
        {tokens.length > 0 ? (
          tokens.join(" ")
        ) : (
          <span className="text-muted-foreground">Nothing streamed yet.</span>
        )}
      </output>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </section>
  );
}
