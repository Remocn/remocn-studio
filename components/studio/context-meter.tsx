"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { contextReading } from "@/lib/studio/context";
import { cn } from "@/lib/utils";
import type { ContextUsage } from "@/shared/ipc";

const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CROWDED = 80;

export function ContextMeter({ usage }: { usage: ContextUsage }) {
  const reading = contextReading(usage);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex size-7 items-center justify-center text-muted-foreground" />
        }
      >
        <svg className="size-4 -rotate-90" role="img" viewBox="0 0 16 16">
          <title>{`Context used: ${reading.percent}%`}</title>
          <circle
            className="stroke-border"
            cx="8"
            cy="8"
            fill="none"
            r={RADIUS}
            strokeWidth="2.5"
          />
          <circle
            className={cn(
              "stroke-current transition-[stroke-dashoffset] duration-500",
              reading.percent >= CROWDED && "stroke-destructive"
            )}
            cx="8"
            cy="8"
            fill="none"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={
              CIRCUMFERENCE * (1 - Math.min(reading.percent, 100) / 100)
            }
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent>
        {`${reading.used} tokens used · ${reading.remaining} left`}
      </TooltipContent>
    </Tooltip>
  );
}
