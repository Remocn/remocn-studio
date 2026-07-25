"use client";

import { RotateCwIcon, ScrollTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useRevealInFinder } from "@/hooks/use-reveal-in-finder";
import { type Sidecar, useSidecar } from "@/hooks/use-sidecar";
import { SidecarStreamTest } from "./sidecar-stream-test";

type Phase = Sidecar["phase"];

const LABELS: Record<Phase, string> = {
  down: "Sidecar down",
  ready: "Sidecar",
  restarting: "Sidecar restarting",
  starting: "Sidecar starting",
  unknown: "Sidecar",
};

const DOTS: Record<Phase, string> = {
  down: "text-destructive border-destructive hover:text-destructive",
  ready: "text-emerald-500 border-emerald-500 hover:text-emerald-500",
  restarting: "text-amber-500 border-amber-500 hover:text-amber-500",
  starting: "text-amber-500 border-amber-500 hover:text-amber-500",
  unknown:
    "text-muted-foreground border-muted-foreground hover:text-muted-foreground",
};

export function SidecarStatus() {
  const sidecar = useSidecar();
  const logPath = sidecar.status?.logPath ?? null;
  const { canReveal, reveal } = useRevealInFinder(logPath);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-invalid={sidecar.phase === "down"}
            className={DOTS[sidecar.phase]}
            size="sm"
            variant="outline"
          />
        }
      >
        {LABELS[sidecar.phase]}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 gap-3" side="bottom">
        <div className="flex flex-col gap-1">
          <PopoverTitle className="text-sm">
            {LABELS[sidecar.phase]}
          </PopoverTitle>
          <p className="text-muted-foreground text-xs">{describe(sidecar)}</p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Process</dt>
          <dd className="font-mono">{sidecar.status?.pid ?? "—"}</dd>
          <dt className="text-muted-foreground">Log</dt>
          <dd className="truncate font-mono" title={logPath ?? undefined}>
            {logPath ?? "—"}
          </dd>
        </dl>

        <div className="flex items-center gap-1">
          <Button onClick={sidecar.restart} size="xs" variant="outline">
            <RotateCwIcon data-icon="inline-start" />
            Restart
          </Button>
          <Button
            disabled={!canReveal}
            onClick={reveal}
            size="xs"
            variant="ghost"
          >
            <ScrollTextIcon data-icon="inline-start" />
            Reveal log
          </Button>
        </div>

        {sidecar.restartError ? (
          <p className="text-destructive text-xs">{sidecar.restartError}</p>
        ) : null}

        <Separator />

        <SidecarStreamTest disabled={!sidecar.isReady} />
      </PopoverContent>
    </Popover>
  );
}

function describe(sidecar: Sidecar): string {
  const { status } = sidecar;

  if (status === null) {
    return "Waiting for the Tauri core";
  }

  if (status.detail !== null) {
    return status.attempt > 1
      ? `${status.detail} Attempt ${status.attempt} of 4`
      : status.detail;
  }

  switch (status.phase) {
    case "ready":
      return "Running, and answering requests";
    case "starting":
      return status.attempt > 1
        ? `Starting, attempt ${status.attempt} of 4`
        : "Starting";
    default:
      return "";
  }
}
