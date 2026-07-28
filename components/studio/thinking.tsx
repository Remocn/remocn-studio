import { SparklesIcon } from "lucide-react";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { runningTime } from "@/lib/studio/time";

export function Thinking({
  now,
  startedAt,
}: {
  now: number;
  startedAt: number | null;
}) {
  return (
    <Marker>
      <MarkerIcon>
        <SparklesIcon />
      </MarkerIcon>
      <MarkerContent className="shimmer">Thinking…</MarkerContent>
      {startedAt === null ? null : (
        <span className="shrink-0 text-muted-foreground/70 text-xs tabular-nums">
          {runningTime(startedAt, now)}
        </span>
      )}
    </Marker>
  );
}
